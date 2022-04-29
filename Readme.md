![non-failing-case-diagram](https://user-images.githubusercontent.com/77400522/165881641-da261597-ad8c-4891-8d47-5295acd1558c.png)
![class-diagram](https://user-images.githubusercontent.com/77400522/165881644-5f992718-ef48-4a36-b6dc-6ba4a4a5e271.png)

### Circuit Breaker가 왜 필요할까 ?

외부 API 호출과 같은 remote call시에 호출 실패나 hang 등을 고려하지 않을 수 없습니다. 일시적이고 단발성인 오류는 적절히 timeout을 주고 오류를 try-catch하면 되지만 오류가 장시간 계속 발생할 때는 이런 방식으로 해결할 수 없는 경우가 발생합니다. 응답을 받지 못한 request가 timeout이 되는 시간까지 `Thread Pool`이나 `DB Pool`을 선점하고 있거나 메모리를 잡아 먹으면서 점차 리소스는 부족해지고 같은 리소스를 사용하고 있는 다른 부분들에도 순식간에 장애가 전파되기 시작합니다.

### 그렇다면 이런 문제를 해결하기 위해서는 어떻게 해야 될까요 ?

> 1. `오류가 전파되지 않도록 공유하고 있는 리소스 분리`
> 2. `오류 발생시 오랫동안 리소스를 잡아두지 못하게 한다.`

Circuit Breaker 패턴은 전기의 회로차단기에서 차용한 개념입니다. 회로가 close될때는 정상적으로 전기가 흐르다가 문제가 생기면 회로를 open하여 더 이상 저니각 흐르지 않도록 한 것과 같이 평소 (Close state)에는 정상적으로 동작하다가 오류 발생시 (Open state) 더이상 동작하지 않도록 합니다. 이렇게 문제가 되는 기능 자체를 동작하지 않게 해서 리소스를 점유하지 않게 하는 겁니다.

<img width="693" alt="스크린샷 2022-04-29 오후 2 48 44" src="https://user-images.githubusercontent.com/77400522/165890918-c6db3612-4410-4a03-94fd-bac795478b10.png">

물론 전류가 복구되면 다시 정상화 되는 회로 차단기처럼 기능이 복구되면 다시 서비스를 정상화시켜야 합니다. 일정 시간이 지났다고 무작정 정상 상태(Close state)로 돌리면 request가 갑자기 몰리면서 문제가 다시 발생하게 됩니다. 그래서 일부 request만 실행해보면서 기능이 다시 정상적으로 동작하는지 확인하는 과정(Half open state)이 필요합니다. 그렇게 정상화되었다고 판단되면 다시 원래 상태로 복구하게 됩니다.

> - 정상 상태: `Close`
> - 오류 상태: `Open`
> - 반열림 상태: `Half Open`

![state-diagram](https://user-images.githubusercontent.com/77400522/165881638-41f8f358-24a7-4d01-93ff-22a1b68cfe3d.png)
