export interface LoginContinueStatus {
  account_select_required: boolean
  profile_confirmation_required: boolean
  password_change_required: boolean
  tos_required: boolean
  email_registration_guide_required: boolean
  benesse_account_invitation_code_required: boolean
}

export interface LoginMethod {
  name: string
  recaptcha: boolean
}

export interface IdApiStatus {
  old_id: string
  username: string
  account_type: string
  school_name: string
  user_display_name: string
  profile_image_url: string
}

export interface ClassiUser {
  userFullName: string
  userPhotoUrl: string
  userTypeId: number
  userId: string
  schoolId: string
  school: {
    id: number
    isBenesseTestResultDisplayAllowed: boolean
  }
}

export interface SubjectCategory {
  id: number
  name: string
}

export interface Teacher {
  userId: number
  name?: string
  familyName?: string
  givenName?: string
}

export interface StudentTaskSummary {
  id: number
  progressStatus: "notStarted" | "inProgress" | "completed"
  isCompleted: boolean
  subjectCategory: SubjectCategory
  task: {
    type: string
    id: number
    title: string
    startedAt: string
    closedAt: string
    questionSectionCount?: number
    estimatedAnswerTimeInSec?: number
  }
  teacher: Teacher
}

export interface LessonStudentTask {
  id: number
  progressStatus: string
  completedAt: string | null
  subjectCategory: SubjectCategory
  lessonTask: {
    id: number
    title: string
    startedAt: string
    closedAt: string
  }
  learningTopics: LearningTopic[]
  teacher: Teacher
}

export interface LearningTopic {
  id: number
  progressStatus: string
  answeredQuestionsCount: number
  correctQuestionsCount: number
  name: string
  estimatedAnswerTimes: number
  questionSectionsCount: number
  videoId: string | null
  nextQuestionSection: { id: number; number: number } | null
}

export interface AnswerOption {
  key: string
  symbol: string
  content: string
  Typename?: string
}

export interface Question {
  id: number
  answerFormat: "SINGLE_SELECT" | "MULTIPLE_SELECT" | string
  content: {
    sentence?: string
    headExplanation?: string
    tailExplanation?: string
    answerOptions?: AnswerOption[]
    blankSymbols?: unknown[]
    correctAnswers?: { blankSymbol: string | null; answerOption: AnswerOption }[]
    explanation?: string
    showAnswerOption?: boolean
  }
  difficulty?: string
  estimatedAnswerTimeInSec?: number
  number?: number
  pointOfView?: string
  teachingUnitPaths?: unknown[]
}

export interface QuestionSection {
  id: number
  attributesLastUpdatedAt: string
  code: string
  contentsLastUpdatedAt: string
  difficulty: string
  content: {
    sentence: string
    headExplanation: string
    tailExplanation: string
  }
  questions: Question[]
  teachingUnitPath?: {
    largeTeachingUnit: string
    middleTeachingUnit: string
    smallTeachingUnit: string
    subject: string
    subjectCategory: string
    schoolStage: string
  }
  title: string
}

export interface AnswerSubmissionResult {
  answerId: number
}

export interface AnswerResult {
  id: number
  answeredAt: string
  questionSection: QuestionSection & {
    questionAnswers: {
      questionId: number
      questionNumber: number
      isCorrect: boolean
      answerOptions: { blankSymbol: string | null; answerOption: AnswerOption }[]
    }[]
  }
  totalQuestionsCount: number
  correctAnswersCount: number
}

export interface TopicProgress {
  lessonStudentTaskLearningTopicId: number
  progressStatus: string
  completedAt: string | null
  answeredQuestionsCount: number
  correctQuestionsCount: number
  learningTopicName: string
  videoId: string | null
  questionSections: QuestionSection[]
}

export interface ActivityDaySummary {
  date: string
  answerSubmissionCount: number
}

export interface SelfTrainingSubject {
  id: number
  subjectCategoryId: number
  name: string
}
