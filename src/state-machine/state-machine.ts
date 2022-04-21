import {
  CircuitBreakerState,
  ClosedCircuit,
  HalfOpenCircuit,
  OpenCircuit,
} from './states';

type Event = 'BeforeCallSignal' | 'CallSucceed' | 'CallFailed';

type Matcher = {
  on: (event: Event, fn: () => CircuitBreakerState) => Matcher;
  transition: () => CircuitBreakerStateMachine;
};

class CircuitBreakerStateMachine {
  constructor(
    readonly currentState: CircuitBreakerState,
    private readonly isThresholdReached: (fails: number) => boolean,
    private readonly isTimeoutReached: (openCircuit: OpenCircuit) => boolean,
  ) {}

  private matched = (state: CircuitBreakerState) => ({
    on: () => this.matched(state),
    transition: () => this.transitionTo(state),
  });

  private match: (matchEvent: Event) => Matcher = (matchEvent: Event) => ({
    on: (event: Event, fn: () => CircuitBreakerState) =>
      event === matchEvent ? this.matched(fn()) : this.match(matchEvent),
    transition: () => this,
  });

  private transitionTo = (nextState: CircuitBreakerState) =>
    new CircuitBreakerStateMachine(
      nextState,
      this.isThresholdReached,
      this.isTimeoutReached,
    );

  private transitionFromClosed = (closed: ClosedCircuit, event: Event) =>
    this.match(event)
      .on('CallSucceed', () => closed.reset())
      .on('CallFailed', () =>
        this.isThresholdReached(closed.failCount + 1)
          ? closed.trip()
          : closed.increaseFails(),
      )
      .transition();
}
