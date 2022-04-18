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
}
