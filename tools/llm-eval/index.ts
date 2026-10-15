import {basic,student} from './cases';
import {real} from './real';
import {focus} from './focus';
export {caseContext,refDecision,type EvalSuite,type EvalCase} from './cases';
/** focus: 지금 만드는 세 기능(주 지표), basic: 서버 PC 비교 기준, student·real: 넓은 회귀용. */
export const suites={focus,basic,student,real};
