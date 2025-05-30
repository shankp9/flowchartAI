import { sanitizeMermaidCode } from "./utils"

// Test function for the specific old flowchart syntax
export function testOldFlowchartConversion() {
  const oldFlowchartCode = `flowchart
st=>start: Start
op1=>operation: Enter Username and Password
cond1=>condition: Correct credentials?
cond2=>condition: Account locked?
op2=>operation: Reset Password
op3=>operation: Unlock Account
op4=>operation: Login Successful
op5=>operation: Display Error Message
e=>end: End
st->op1->cond1
cond1(yes)->op4->e
cond1(no)->cond2
cond2(yes)->op3->op1
cond2(no)->op5->op1`

  console.log("Original old flowchart syntax:")
  console.log(oldFlowchartCode)
  console.log("\nConverted to Mermaid syntax:")
  console.log(sanitizeMermaidCode(oldFlowchartCode))
}

// The expected output should be proper Mermaid syntax:
export const expectedMermaidOutput = `graph TD
    st((Start))
    op1[Enter Username and Password]
    cond1{Correct credentials?}
    cond2{Account locked?}
    op2[Reset Password]
    op3[Unlock Account]
    op4[Login Successful]
    op5[Display Error Message]
    e((End))
    st --> op1
    op1 --> cond1
    cond1 -->|yes| op4
    op4 --> e
    cond1 -->|no| cond2
    cond2 -->|yes| op3
    op3 --> op1
    cond2 -->|no| op5
    op5 --> op1`
