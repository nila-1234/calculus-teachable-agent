/**
 * Consent form text, transcribed from the IRB-approved document.
 *
 * Kept as data rather than markup so the wording can be diffed against the
 * approved version. Do not reword any of this without IRB sign-off.
 */

export type ConsentSection = {
  heading: string;
  paragraphs: string[];
};

export const CONSENT_TITLE = "User Study Consent Form – Campus (2a)";

export const CONSENT_INTRO =
  "This study is part of a research study conducted at Carnegie Mellon University.";

export const CONSENT_SECTIONS: ConsentSection[] = [
  {
    heading: "Summary",
    paragraphs: [
      "This study will examine how a Large Language Model-based tool can be used to support students with higher-order reasoning skills in college-level calculus.",
    ],
  },
  {
    heading: "Purpose",
    paragraphs: [
      "The purpose of this research is to explore how Large Language Model (LLM)-based tools can be used to help students develop higher-order calculus reasoning skills, such as model formulation and model evaluation. These skills are essential for applying calculus in real-world contexts but are not typically emphasized in traditional instruction due to limited instructional time.",
    ],
  },
  {
    heading: "Procedures",
    paragraphs: [
      "This will be an in-person or remote study.",
      "• You will first fill out a pre-survey with demographic information and prior calculus experience (around 5 minutes).",
      "• Then, you will complete a pre-test (around 15 minutes), which will assess your ability to interpret, formulate and evaluate calculus-based problems.",
      "• You will then interact with the tool (around 45 minutes). During this activity, you will create or critique real-world calculus problems and evaluate AI-generated solutions.",
      "• Finally, you will complete a post-test similar to the pretest (around 15 minutes), and then will fill out a post-survey asking about your interaction experiences (around 5 minutes).",
      "The expected duration of participation in the study is 90 minutes.",
    ],
  },
  {
    heading: "Participant Requirements",
    paragraphs: [
      "Participation in this study is limited to individuals age 18 and older. You must have access to the internet and a laptop to participate in the study.",
    ],
  },
  {
    heading: "Risks",
    paragraphs: [
      "There may be a risk of a potential breach of confidentiality.",
      "Payment Confidentiality: Payment methods, especially those facilitated by third-party vendors (such as Venmo, Amazon, PayPal), may require that the researchers and/or the vendor collect and use personal information (such as your first and last name, email addresses, phone numbers, banking information) provided by you in order for your payment to be processed. As with any payment transaction, there is the risk of a breach of confidentiality from the third-party vendor. All personal information collected by the researcher will be held as strictly confidential and stored in a password-protected digital file, or in a locked file cabinet, until payments are processed and reconciled. This information will be destroyed at the earliest acceptable time. Personal information held by the third-party vendor will be held according to their terms of use policy.",
    ],
  },
  {
    heading: "Benefits",
    paragraphs: [
      "There may be no personal benefit from your participation in the study, but the knowledge received may be of value to humanity. You may get some educational values of communication practices from interacting with our tool.",
    ],
  },
  {
    heading: "Compensation & Costs",
    paragraphs: [
      "There is a $20 compensation for completion of this study (the last study task is the post-survey asking about your interaction with our tool). There will not be partial payment for partial completion of the tasks. There will be no cost to you if you participate in this study.",
    ],
  },
  {
    heading: "Future Use of Information",
    paragraphs: [
      "In the future, once we have removed all identifiable information from your data (information), we may use the data for our future research studies, or we may distribute the data to other researchers for their research studies. We would do this without getting additional informed consent from you (or your legally authorized representative). Sharing of data with other researchers will only be done in such a manner that you will not be identified.",
    ],
  },
  {
    heading: "Confidentiality",
    paragraphs: [
      "Your IP address will not be collected.",
      "The study will collect your research data through your use of Google, Zoom, and Qualtrics. These companies are not owned by CMU. These companies will have access to the research data that you produce and any identifiable information that you share with them while using their products. Please note that Carnegie Mellon does not control the Terms and Conditions of the companies or how they will use or protect any information that they collect.",
      "The researchers will take the following steps to protect your identities during this study: (1) You will be assigned an anonymous subject ID; (2) The researchers will record any data collected during the study by subject ID, not by name; (3) Any original data files will be stored on a secured storage device with strict access control, accessed only by authorized researchers, and be de-identified afterward, and all original data containing personal identifiers will be deleted permanently, only the de-identified data will be finally kept and analyzed.",
      "By participating in this research, you understand and agree that Carnegie Mellon may be required to disclose your consent form, data, and other personally identifiable information as required by law, regulation, subpoena or court order. Otherwise, your confidentiality will be maintained in the following manner:",
      "Your data and consent form will be kept separate. By participating, you understand and agree that the data and information gathered during this study may be used by Carnegie Mellon and published and/or disclosed by Carnegie Mellon to others outside of Carnegie Mellon. However, your name, address, contact information and other direct personal identifiers will not be mentioned in any such publication or dissemination of the research data and/or results by Carnegie Mellon. Note that per regulation all research data must be kept for a minimum of 3 years.",
    ],
  },
  {
    heading: "Right to Ask Questions & Contact Information",
    paragraphs: [
      "If you have any questions about this study, you should feel free to ask them by contacting the Principal Investigator now:",
      "Qianou (Christina) Ma\nHuman-Computer Interaction Institute\nCarnegie Mellon University\n5000 Forbes Ave\nPittsburgh, PA 15213\nqianoum@cs.cmu.edu",
      "If you have questions later, desire additional information, or wish to withdraw your participation please contact the Principal Investigator by mail, phone, or e-mail in accordance with the contact information listed above.",
      "If you have questions pertaining to your rights as a research participant; or to report concerns to this study, you should contact the Office of Research Integrity and Compliance at Carnegie Mellon University.",
      "Email: irb-review@andrew.cmu.edu\nPhone: 412-268-4721.",
    ],
  },
  {
    heading: "Voluntary Participation",
    paragraphs: [
      "Your participation in this research is voluntary. You may refuse or discontinue participation at any time without any loss of benefits to which you are otherwise entitled.",
    ],
  },
];

/** All three must be affirmed before the study can begin. */
export const CONSENT_AGREEMENTS = [
  { id: "age", text: "I am age 18 or older." },
  { id: "understood", text: "I have read and understood the information above." },
  {
    id: "participate",
    text: "I want to participate in this research and continue with the activity.",
  },
] as const;
