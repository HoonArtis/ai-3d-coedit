import {basic,student} from './cases';
import {real} from './real';
export {caseContext,refDecision,type EvalSuite,type EvalCase} from './cases';
/** basic: 서버 PC 비교 기준, student: 말투 회귀용, real: 실사용 비중(주 지표). */
export const suites={basic,student,real};
