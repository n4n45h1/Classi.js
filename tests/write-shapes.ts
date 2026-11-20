import type {
  ClassiClient, GroupAttachment, TalkroomAttachment, UploadedAttachment,
  TrainingAnswerInput, TrainingQuestionAnswer, LessonAnswerSubmission,
  PersonalizedAnswerSubmission, TaskQuestionSectionAnswers, NumberedQuestionAnswers,
  LegacyNumberedQuestionAnswers, LegacySelfTrainingSubmissionContext,
  SelfTrainingSubmissionContext, ShikakuSubmissionContext, MissionPlan, MissionDay,
  MissionSettings, CreateMissionPayload, UpdatedMission, CreatedDailyMission,
  SubmitPayload, AnswerSubmissionResult,
} from "../dist/index.js"

declare const client: ClassiClient
declare const uploaded: UploadedAttachment
const groupAttachment: GroupAttachment = uploaded
const talkroomAttachment: TalkroomAttachment = {
  entry_cd: uploaded.entry_cd, type: uploaded.file_type,
  download_url: uploaded.download_uri, file_name: uploaded.name,
}
const answer: TrainingAnswerInput = { blank_symbol: null, answer_option_key: "A" }
const question: TrainingQuestionAnswer = { id: 1, answers: [answer] }
const lesson: LessonAnswerSubmission = { question_section_id: 1, questions: [question] }
const personalized: PersonalizedAnswerSubmission = { ...lesson, current_answer_submissions_count: 2 }
const task: TaskQuestionSectionAnswers = { id: 1, questions: [question] }
const numbered: NumberedQuestionAnswers = { question_number: 1, answers: [answer] }
const legacyNumbered: LegacyNumberedQuestionAnswers = { ...numbered, is_correct: true }
const legacyContext: LegacySelfTrainingSubmissionContext = "self_training"
const context: SelfTrainingSubmissionContext = "self_training_benesse_test_summary_recommendation"
const shikakuContext: ShikakuSubmissionContext = "self_training_recommended_question"
const plan: MissionPlan = "focus_weakness"
const days: MissionDay[] = ["monday"]
const settings: MissionSettings = { learning_minutes: 15, plan, day_of_weeks: days }
const mission: CreateMissionPayload = { ...settings, learning_target: { type: "subject", subject_id: 1 } }
const legacy: SubmitPayload = { id: 1, question_section_id: 1, questions: [{ id: 1, answers: [{ answer_option_key: "A" }] }] }

const lessonResult: Promise<AnswerSubmissionResult> = client.training.submitLessonAnswers(1, lesson)
const legacyResult: Promise<AnswerSubmissionResult> = client.training.submitAnswers(1, legacy)
const personalizedResult: Promise<AnswerSubmissionResult> = client.training.submitPersonalizedAnswers(1, personalized)
const testResult: Promise<void> = client.training.submitTaskTestAnswers(1, [task])
const recommendedResult: Promise<{ id: number }> = client.training.submitRecommendedAnswers(1, 1, task)
client.training.submitSelfTrainingAnswers(1, [numbered], context)
client.training.submitLegacySelfTrainingAnswers(1, [legacyNumbered], legacyContext)
client.training.submitShikakuAnswers(1, [numbered], shikakuContext)
client.training.submitKoumuinAnswers(1, [numbered])
client.training.submitShushokuAnswers(1, [numbered])
client.training.submitDailyMissionAnswers(1, lesson)
const created: Promise<{ id: number }> = client.training.createMission(mission)
const updated: Promise<UpdatedMission> = client.training.updateMission(1, settings)
const deleted: Promise<void> = client.training.deleteMission(1)
const daily: Promise<CreatedDailyMission> = client.training.createDailyMission(1)
client.platform.sendGroupMessage(1, "message", [groupAttachment])
client.platform.commentOnGroupMessage(1, 2, "comment", [groupAttachment])
client.platform.sendTalkroomMessage(1, "reply", [talkroomAttachment])
const uploadResult: Promise<UploadedAttachment> = client.platform.uploadAttachment(new Blob(["file"]), "file.txt")
client.platform.markGroupMessageRead(1)
client.platform.markTalkroomMessageRead(1, 2)
client.platform.invalidateCsrf()
client.study.setTargetGtz(["B1"])
client.study.setTargetGtz("B1")

// @ts-expect-error The modern lesson schema requires blank_symbol, even when null.
client.training.submitLessonAnswers(1, legacy)
// @ts-expect-error Qualification contexts cannot be used for ordinary self-training.
client.training.submitSelfTrainingAnswers(1, [numbered], "self_training_shikaku")
// @ts-expect-error Context belongs in the query argument, not the answer body.
client.training.submitShikakuAnswers(1, { answers: [numbered], submission_context: shikakuContext })
// @ts-expect-error The deprecated route requires caller-supplied correctness.
client.training.submitLegacySelfTrainingAnswers(1, [numbered])
// @ts-expect-error The mission plan must be a supported API enum value.
client.training.createMission({ ...mission, plan: "unknown" })
// @ts-expect-error Recommended answer payloads require the section id.
client.training.submitRecommendedAnswers(1, 1, { questions: [question] })

void [lessonResult, legacyResult, personalizedResult, testResult, recommendedResult, created, updated, deleted, daily, uploadResult]
