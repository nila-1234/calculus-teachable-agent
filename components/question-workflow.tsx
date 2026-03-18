// "use client";

// import { useState } from "react";
// import AiStudentPanel from "./ai-student-panel";
// import AuthorQuestionPanel from "./author-question-panel";

// export default function QuestionWorkflow() {
//   const [question, setQuestion] = useState("");
//   const [questionSubmitted, setQuestionSubmitted] = useState(false);
//   const [questionFeedback, setQuestionFeedback] = useState("");

//   const [rubric, setRubric] = useState("");
//   const [rubricSubmitted, setRubricSubmitted] = useState(false);
//   const [rubricFeedback, setRubricFeedback] = useState("");

//   const handleQuestionSubmit = () => {
//     setQuestionSubmitted(true);
//     setQuestionFeedback(
//       "Your question is on the right track. It asks students to identify a local minimum, but it could more clearly require them to explain why a change from decreasing to increasing behavior matters in a smooth model."
//     );
//   };

//   const handleRubricSubmit = () => {
//     setRubricSubmitted(true);
//     setRubricFeedback(
//       "Your rubric is mostly strong. It evaluates the explanation, not just the final answer, and it uses relevant mathematical language. To improve it, make common misconceptions more explicit, such as treating the smallest table value as sufficient evidence."
//     );
//   };

//   return (
//     <div className="space-y-8">
//       <AuthorQuestionPanel
//         question={question}
//         setQuestion={setQuestion}
//         submitted={questionSubmitted}
//         feedback={questionFeedback}
//         onSubmit={handleQuestionSubmit}
//       />

//       {questionSubmitted && (
//         <AiStudentPanel
//           question={question}
//           rubric={rubric}
//           setRubric={setRubric}
//           submitted={rubricSubmitted}
//           feedback={rubricFeedback}
//           onSubmit={handleRubricSubmit}
//         />
//       )}
//     </div>
//   );
// }