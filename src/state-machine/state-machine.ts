import {
  CircuitBreakerState,
  ClosedCircuit,
  HalfOpenCircuit,
  OpenCircuit,
} from './states';

type Event = 'BeforeCallSignal' | 'CallSucceed' | 'CallFailed';

// type Matcher = {
//   on: (event: Event, fn:())
// }
