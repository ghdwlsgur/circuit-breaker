import {
  CircuitBreakerState,
  ClosedCircuit,
  HalfOpenCircuit,
  OpenCircuit,
} from './states';

/** // ! type 정의 1
 * @type BeforeCallSignal : 호출되기 전
 * @type CallSucceed : 호출 성공
 * @type CallFailed : 호출 실패
 */
type Event = 'BeforeCallSignal' | 'CallSucceed' | 'CallFailed';

/** // ! type 정의 2
 * @functionType on : 매개변수로 호출상태를 정의하는 event와 CircuitBreakerState를 반환하는
 * 콜백함수 fn을 전달받아야 하며 리턴타입은 Matcher이므로 on 메서드 정의시 on과 transition를 모두 정의하여야 한다.
 * @functionType transition : CircuitBreakerStateMachine 클래스 객체를 반환해야 한다.
 */
type Matcher = {
  on: (event: Event, fn: () => CircuitBreakerState) => Matcher;
  transition: () => CircuitBreakerStateMachine;
};

/** 호출 이벤트별로 값을 핸들링하는 클래스
 * @initCurrentState 함수 매개변수로 CircuitBreakerState 타입의 currentState를 전달받고 이는 곧 현재 상태를 의미한다.
 * @initIsThreshold @initIsTimeoutReached 접근제어자 private로 클래스 외부에서 접근하지 못하도록 하는 isThresholdReached, isTimeoutReached를
 * 각각 매개변수로 전달받고 이 둘은 곧 콜백함수로서 isThresholdReached는 매개변수로 number 타입의
 * fails를 매개변수로 전달받아 True/False를 반환하며 isTimeoutReached는 openCircuit 매개변수
 * 를 전달받아 동일하게 True/False를 반환한다.
 */

/** matched와 match 메서드에서는 왜 객체로 정의했을까 ?
 * 객체는 자신의 프로토타입 객체의 프로퍼티의 접근할 수 있습니다.
 * 이를 이용해서 prototype chaining으로 객체에서 프로퍼티를 체이닝하여 핸들링하기 위해서
 * 객체를 정의하고 객체 안 함수 프로퍼티로 각각 정의하였습니다.
 */
class CircuitBreakerStateMachine {
  constructor(
    readonly currentState: CircuitBreakerState,
    private readonly isThresholdReached: (fails: number) => boolean,
    private readonly isTimeoutReached: (openCircuit: OpenCircuit) => boolean,
  ) {}

  private matched = (state: CircuitBreakerState) => ({
    // on 메서드의 리턴타입은 Matcher로 on과 transition 모두를 포함하고 있어야 하기 때문에
    // 모두 포함되어 있는 matched를 통으로 반환한다. 즉 자기자신을 호출하는 재귀함수이다.
    on: () => this.matched(state),
    // CircuitBreakerStateMachine 인스턴스를 반환하는 메서드 transitionTo를 호출한다.
    transition: () => this.transitionTo(state),
  });

  // event를 매개변수로 전달받고 Matcher 타입으로 리턴한다.
  private match: (matchEvent: Event) => Matcher = (matchEvent: Event) => ({
    // match 메서드에서 on 프로퍼티는 event와 CircuitBreakerState를 리턴하는 콜백 함수를
    // 매개변수로 전달받고 event 인수가 메서드의 매개변수로 전달받은 인수와 동일할 경우 matched
    // 메서드를 호출하고 그렇지 않을 경우 자기 자신(클래스)의 match를 호출한다.
    on: (event: Event, fn: () => CircuitBreakerState) =>
      event === matchEvent ? this.matched(fn()) : this.match(matchEvent),
    // transition 프로퍼티는 CircuitBreakerStateMachine 객체를 반환하는데
    // this는 현재 클래스를 가리키므로 리턴타입이 동일하다.
    transition: () => this,
  });

  // 상태 변환을 다루는 transitionTo 메서드는 다음 상태의 값을 가지고 있는 nextState
  // 매개변수를 전달받고 CircuitBreakerStateMachine 인스턴스를 생성한다.
  private transitionTo = (nextState: CircuitBreakerState) =>
    new CircuitBreakerStateMachine(
      nextState,
      this.isThresholdReached,
      this.isTimeoutReached,
    );

  /** ClosedCircuit
   * 현재 상태가 닫힌 ClosedCircuit일 경우
   * @param closed
   * @param event
   * @returns CircuitBreakerStateMachine
   * @description 닫힌 상태에서 성공할 경우 ClosedCircuit 인스턴스의 reset 메서드를 호출하고
   * 실패한 경우라면 isThresholdReached를 호출하고 실패 횟수를 의미하는 매개변수 failCount에
   * 1을 더하여 줍니다. 메서드를 호출한 결과가 true일 경우 OpenCircuit 인스턴스를 생성하고 그렇지
   * 않을 경우 앞서 설명한 경우와 같이 실패 횟수를 증가합니다.
   *
   * 체이닝의 마지막에 transition 프로퍼티가 실행되기 때문에 반환값은 현재 클래스를 생성하게 됩니다.
   * 여기서 현재 클래스란 CircuitBreakerStateMachine를 의미합니다. 이것에 대한 설명은
   * transitionFromClosed, nextStateFromHalfOpen 메서드 모두에서 동일한 설명이므로
   * 아래 주석에는 생략하겠습니다.
   */
  private transitionFromClosed = (closed: ClosedCircuit, event: Event) =>
    this.match(event)
      .on('CallSucceed', () => closed.reset())
      .on('CallFailed', () =>
        this.isThresholdReached(closed.failCount + 1)
          ? closed.trip()
          : closed.increaseFails(),
      )
      .transition();

  /** halfOpenCircuit
   * 현재 상태가 반 열린 HalfOpenCircuit일 경우
   * @param halfOpen
   * @param event
   * @returns CircuitBreakerStateMachine
   * @description 반 열린 상태에서 실패할 경우 trip 메서드를 호출하고 성공할 경우 reset 메서드를
   * 호출합니다.
   */
  private nextStateFromHalfOpen = (halfOpen: HalfOpenCircuit, event: Event) =>
    this.match(event)
      .on('CallSucceed', () => halfOpen.reset())
      .on('CallFailed', () => halfOpen.trip())
      .transition();

  /** OpenCircuit
   * 현재 상태가 완전히 열린 OpenCircuit일 경우
   * @param open
   * @param event
   * @returns CircuitBreakerStateMachine
   * @description 열린 상태에서 이벤트로 'BeforeCallSignal'이 전달될 경우 isTomeoutReached
   * 메서드를 호출하며 매개변수로 open을 전달받습니다. open은 OpenCircuit 클래스 인스턴스를 의미합니다.
   * 인수로 인스턴스를 전달받아 해당 메서드가 실행되었을 때의 결과가 참일 경우 OpenCircuit 클래스
   * 인스턴스의 tryReset 메서드를 호출하고 False일 경우 인스턴스 자체를 반환합니다.
   */
  private nextStateFromOpen = (open: OpenCircuit, event: Event) =>
    this.match(event)
      .on('BeforeCallSignal', () =>
        this.isTimeoutReached(open) ? open.tryReset() : open,
      )
      .transition();

  // 앞서 states.ts에서 정의한 인터페이스의 추상 메서드를 구현할 때 Open 상태를 제외하고
  // 모두 true를 반환하도록 하였는데 즉, Open 상태에서 아래 메서드를 실행할 경우
  // 의도적으로 실패한 상태로 전환합니다.
  public shouldFailFast = () => !this.currentState.isCallPermitted();

  // ! 체이닝으로 사용한 transition 프로퍼티와 아래 transition 메서드는 이름만 동일합니다.
  // 아래 메서드로 정의된 transition은 접근제어자로 public을 사용했기 때문에 다른 클래스에서도
  // 접근이 가능하며 이를 위해 생성하고 사용하는 메서드입니다. matched 메서드 및 match 에서 선언된
  // 객체 프로퍼티와는 다른 함수이므로 주의하시기 바랍니다 :)

  /** transition
   * 외부에서 접근 가능한 transition 클래스 내부에서는 matched 및 match의 프로퍼티인
   * transition을 활용하여 핸들링하지만 아래 메서드는 외부에서 값을 변경 및 호출하기 위해서
   * 사용하는 메서드입니다.
   * @param event  'BeforeCallSignal' | 'CallSucceed' | 'CallFailed'
   * @returns CircuitBreakerStateMachine
   * 조건문안에서 각 메서드는 모두 동일하게 CircuitBreakerStateMachine 인스턴스를
   * 반환하기 때문에 해당 클래스 타입으로 리턴 타입을 정의하였습니다.
   */
  public transition(event: Event): CircuitBreakerStateMachine {
    // 현재 클래스 함수에서 생성자 함수 매개변수로 전달받은 currentState가
    // ClosedCircuit일 경우 transitionFromClosed 메서드를 호출합니다.
    // 아래 조건문 설명도 동일하므로 생략하겠습니다.
    // 단, nextStateFromHalfOpen에서 as 를 통해 리턴타입을 명시한 경우
    // 컴파일 과정에서 발생하는 에러를 피하기 위해서입니다.
    if (this.currentState instanceof ClosedCircuit)
      return this.transitionFromClosed(this.currentState, event);
    else if (this.currentState instanceof OpenCircuit)
      return this.nextStateFromOpen(this.currentState, event);
    else
      return this.nextStateFromHalfOpen(
        this.currentState as HalfOpenCircuit,
        event,
      );
  }
}

export { Event, CircuitBreakerStateMachine };
