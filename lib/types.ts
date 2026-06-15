export interface SessionUser {
  id: number;
  username: string;
  currentLevel: number;
}

export interface Country {
  id: number;
  name: string;
  flagPath: string;
  difficultyTier: 1 | 2 | 3 | 4 | 5;
}

export interface Question {
  countryId: number;
  flagPath: string;
  options: string[]; // 4 country names, shuffled, includes correct
  correctOption: string; // the correct country name
}

export interface StartGameResponse {
  level: number;
  questions: Question[];
}

export interface SubmitAnswer {
  countryId: number;
  answer: string | null; // null = timed out
}

export interface AnswerKeyItem {
  countryId: number;
  flagPath: string;
  correctOption: string;
  userAnswer: string | null;
  isCorrect: boolean;
}

export interface SubmitGameResponse {
  score: number; // number correct out of 15
  total: number; // 15
  passed: boolean; // score === 15
  newCurrentLevel: number;
  answerKey: AnswerKeyItem[];
}
