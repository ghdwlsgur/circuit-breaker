// ! Date 객체 반환
const nowSupplier = () => new Date();

// ! 서킷 브레이커 상태 인터페이스 정의
interface CircuitBreakerState {
  isCallPermitted(): boolean;
}

/** State: Open
 * 서킷 브레이커 상태 인터페이스를 구현하는 OpenCircuit 클래스 생성
 */
class OpenCircuit implements CircuitBreakerState {
  constructor(readonly openedAt: Date) {} // 인수로 Date 타입의 읽기 전용 openedAt을 전달받는다.

  public tryReset = () => new HalfOpenCircuit(); // HalfOpenCircuit() 클래스 생성

  // isCallPermitted() => false
  public isCallPermitted = () => false;
}

/** State: HalfOpen
 * 서킷 브레이커 상태 인터페이스를 구현하는 HalfOpenCircuit 클래스 생성
 * OpenCircuit 클래스에서 tryReset 메소드로 생성되게 하여 생정자 함수를 정의하지 않는다.
 */
class HalfOpenCircuit implements CircuitBreakerState {
  // 매개변수로 Date 객체를 생성하는 nowSupplier() 험수를 now로 전달하여 OpenCircuit 인스턴스 생성
  public trip = (now = nowSupplier()) => new OpenCircuit(now);
  // reset 메소드 호출시 ClosedCircuit 인스턴스 생성
  public reset = () => ClosedCircuit.start();

  // isCallPermitted() => true
  public isCallPermitted = () => true;
}

/** State: Closed
 * 서킷 브레이커 상태 인터페이스를 구현하는 ClosedCircuit 클래스 생성
 */
class ClosedCircuit implements CircuitBreakerState {
  // 생성자 함수로 읽기 전용 number 타입의 failCount를 전달받으며 매개변수에 기본값은 0으로 정한다.
  constructor(readonly failCount: number = 0) {}

  // 다른 클래스에서 ClosedCircuit 인스턴스를 생성하지 않고 start 메서드를 호출하기 위해 static으로 설정
  public static start = () => new ClosedCircuit();
  // reset 호출시 객체 생성
  public reset = () => new ClosedCircuit();
  // 실패할 시 실패 횟수를 의미하는 failCount 매개변수의 값을 1 증가
  public increaseFails = () => new ClosedCircuit(this.failCount + 1);
  // 매개변수로 Date 객체를 생성하는 nowSupplier() 함수를 now로 전달하여 OpenCircuit 인스턴스 생성
  public trip = (now = nowSupplier()) => new OpenCircuit(now);

  // isCallPermitted() => true
  public isCallPermitted = () => true;
}

/** 정리
 * 오픈 상태를 의미하는 Class인 OpenCircuit에서 tryReset 메서드 호출시 HalfOpenCircuit
 * 객체 인스턴스를 생성하여 오픈된 상태에서 반 닫힌 상태를 의미하며 HalfOpenCircuit에서 다시 reset
 * 메서드를 호출할 경우 닫힌 상태를 의미하는 ClosedCircuit 인스턴스를 생성한다.
 *
 * 각각의 클래스에서는 모두 인터페이스 메서드를 다르게 정의하였다.
 * OpenCircuit 클래스에서는 false를 리턴, 그 외 다른 클래스들은 모두 true를 리턴한다.
 * HalfOpenCircuit와 ClosedCircuit 클래스에서 모두 공통적으로 trip 메서드를 호출할 경우
 * OpenCircuit 객체 인스턴스를 생성한다.
 *
 * 즉, 반 닫힌 상태 또는 닫힌 상태에서 trip은 Open상태로의 전환을 의미하며
 * 완전히 오픈된 상태에서 닫힌 상태로의 전환은 반 닫힌 상태 => 닫힌 상태로의 전환 순서를 유지한다.
 */

export { CircuitBreakerState, ClosedCircuit, OpenCircuit, HalfOpenCircuit };
