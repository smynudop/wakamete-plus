# コーディング規約

## 全体
* typescriptによる型付けを最大限に活用する。
* requireは禁止し、importのみを使用する。

## Vue
* Composition API, setupを活用する。
* コンポーネントの再利用が望めなくとも、構造の見通しを良くするためにコンポーネント分割してもよい。

## CSS
* padding/margin/gapなどの指定は `rem`/`em` を優先的に使用する。