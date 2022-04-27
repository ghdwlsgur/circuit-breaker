import { CircuitBreakerStateMachine } from './state-machine/state-machine';
import {
  CircuitBreakerState,
  ClosedCircuit,
  OpenCircuit,
} from './state-machine/states';

type CircuitBreakerConfig = {
  maxFailures: number;
  resetTimeoutInMillis: number;
};

export default class CircuitBreaker {
  private stateMachine: CircuitBreakerStateMachine;
  private inUse: boolean = false;
}
