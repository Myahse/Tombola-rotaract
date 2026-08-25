export type QcmExamStatus = "draft" | "open" | "closed";
export type QcmAttemptStatus = "in_progress" | "completed";

export type QcmExam = {
  id: string;
  titleFr: string;
  titleEn: string;
  questionCount: number;
  passScore: number;
  status: QcmExamStatus;
  scoresSent: boolean;
};

export type QcmMonitorAttempt = {
  id: string;
  memberId: string;
  memberName: string;
  memberEmail: string;
  clubName: string | null;
  clubRole: string | null;
  status: QcmAttemptStatus;
  currentIndex: number;
  questionCount: number;
  score: number | null;
  startedAt: string;
  completedAt: string | null;
  lastCorrect: boolean | null;
  lastAnsweredAt: string | null;
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
  correctChoiceId: string;
};

export type QcmAdminState = {
  exam: QcmExam | null;
  questions: QcmQuestion[];
  attempts: QcmMonitorAttempt[];
};
