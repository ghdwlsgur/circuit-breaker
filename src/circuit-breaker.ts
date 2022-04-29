import { CircuitBreakerStateMachine } from './state-machine/state-machine';
import { ClosedCircuit, OpenCircuit } from './state-machine/states';

/** type 정의
 * @maxFailures number 타입으로 최대 실패 횟수를 지정
 * @resetTimeoutInMillis number 타입으로 리셋 타임 아웃 설정 (m/s)
 */
type CircuitBreakerConfig = {
  maxFailures: number;
  resetTimeoutInMillis: number;
};

export default class CircuitBreaker {
  private stateMachine: CircuitBreakerStateMachine;
  private inUse: boolean = false;

  constructor(
    // 최대 실패 횟수 5회
    // 리셋 타임 아웃 1초
    readonly config: CircuitBreakerConfig = {
      maxFailures: 5,
      resetTimeoutInMillis: 1000,
    },
    readonly now: () => Date = () => new Date(),
  ) {
    // initStateMachine 메서드의 반환값을 stateMachine 변수에 담는다.
    this.stateMachine = this.initStateMachine(config, now);
  }

  // 생성자 함수 실행 시 호출되는 private 메서드
  private initStateMachine(config: CircuitBreakerConfig, now: () => Date) {
    // 실패 횟수를 의미하는 fails를 매개변수로 전달받고 boolean을 반환한다.
    // 만약 생성자 함수의 매개변수로 전달받은 객체 인수 config의 maxFailires 프로퍼티보다
    // fails가 값이 더 크거나 같은 경우 true를 반환하고 그렇지 않을 경우 false를 반환한다.
    const isThresholdReached: (fails: number) => boolean = fails =>
      fails >= config.maxFailures;

    // OpenCircuit 인스턴스를 매개변수로 전달받고 만약 전달받은 인수 객체의 getTime()
    // 메서드와 생성자 함수의 인수로 전달받은 config.resetTimeoutInMillis를 합한 값이
    // 현재 시간보다 작을 경우 timeout 상태로 간주하여 true를 반환한다.
    const isTimeoutReached: (open: OpenCircuit) => boolean = open =>
      open.openedAt.getTime() + config.resetTimeoutInMillis < now().getTime();

    // 초기에는 닫힌 상태로 가정하기 때문에 ClosedCircuit 인스턴스를 인수로 전달한다.
    return new CircuitBreakerStateMachine(
      new ClosedCircuit(),
      isThresholdReached,
      isTimeoutReached,
    );
  }

  // 제네릭 타입으로 A와 B를 전달받고 매개변수 call의 타입 또한 A를 전달받고 B를 반환하며
  // 본 메서드 또한 동일하게 A를 전달받고 B를 반환하는 구조이다.
  public protectFunction<A, B>(call: (_: A) => B): (_: A) => B {
    // acquireCircuitBreaker 메서드를 실행한다.
    this.acquireCircuitBreaker();

    // 인수로 A를 전달받는 익명 함수를 반환한다.
    return (argument: A) => {
      // 익명 함수 실행 시 preCall, failFastIfRequired 메서드 실행
      this.preCall();
      this.failFastIfRequired();
      try {
        const result = call(argument);
        this.callSucceed();
        return result;
      } catch (error) {
        this.callFailed();
        throw error;
      }
    };
  }

  // 제네릭 타입 A를 전달받고 비동기로 A를 반환하는 구조이다.
  // 매개변수로 전달받는 콜백 함수 lazyPromise의 반환타입 또한 본 함수의 반환타입과 동일하다.
  public protectPromise<A>(lazyPromise: () => Promise<A>): () => Promise<A> {
    // acquireCircuitBreaker() 메서드를 실행한다.
    this.acquireCircuitBreaker();
    return async () => {
      this.preCall();
      try {
        this.failFastIfRequired();
        try {
          const response = await lazyPromise();
          this.callSucceed();
          return response;
        } catch (error) {
          this.callFailed();
          throw error;
        }
      } catch (error) {
        return Promise.reject(error);
      }
    };
  }

  private acquireCircuitBreaker() {
    if (this.inUse) throw new Error('CircuitBreaker: already-in-use');
    else this.inUse = true;
  }

  private failFastIfRequired() {
    if (this.stateMachine.shouldFailFast())
      throw new Error('CircuitBreaker: fail-fast');
  }

  // event : BeforeCallSignal
  private preCall = () =>
    (this.stateMachine = this.stateMachine.transition('BeforeCallSignal'));

  // event : CallSucceed
  private callSucceed = () =>
    (this.stateMachine = this.stateMachine.transition('CallSucceed'));

  // event: CallFailed
  private callFailed = () =>
    (this.stateMachine = this.stateMachine.transition('CallFailed'));
}
