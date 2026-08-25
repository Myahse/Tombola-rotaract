export type Member = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl?: string | null;
  clubName?: string | null;
  clubRole?: string | null;
  emailVerified?: boolean;
};

export type QcmExamStatus = "draft" | "open" | "closed";
export type QcmAttemptStatus = "in_progress" | "completed";

export type QcmExam = {
  id: string;
  slug: string;
  titleFr: string;
  titleEn: string;
  questionCount: number;
  passScore: number;
  status: QcmExamStatus;
  scoresSent: boolean;
};

export type QcmChoice = {
  id: string;
  textFr: string;
  textEn: string;
};

export type QcmQuestion = {
  id: string;
  position: number;
  promptFr: string;
  promptEn: string;
  choices: QcmChoice[];
};

export type QcmAttempt = {
  id: string;
  status: QcmAttemptStatus;
  currentIndex: number;
  questionCount: number;
  score: number | null;
  startedAt: string;
  completedAt: string | null;
};

export type QcmState = {
  exam: QcmExam | null;
  attempt: QcmAttempt | null;
  question: QcmQuestion | null;
};
