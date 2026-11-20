# Live API audit

Safe calls were made with the provisioned account using `ClassiClient.login()`.
No credentials, session data, or personal response values are retained here.
Responses were inspected by field names, primitive types and array lengths only.

## Coverage

| Surface | Result |
| --- | --- |
| Client | login, session save/restore and fromSession authenticated currentUser succeeded |
| IdApi | loginMethods, login and myStatuses succeeded; changeUsername excluded |
| TrainingApi | currentUser, studentTasks (open/completed), lessonStudentTask, questionSection, nextQuestionSection, topicProgress, activitySummary, selfTrainingSubjects, selfTeachingUnits, academicAbilityTargets succeeded; invalidateCsrf followed by currentUser succeeded (does not exercise CSRF refresh) |
| StudyApi | currentUser, permittedMonths, studentSettings, dailyReport, reportForm, recordedDates, ranking (classroom/club/grade), targetGtz succeeded |
| PlatformApi | userInfo, communicationUser, home, analyticsUser, notifications (all three kinds), unreadCount, groups, newMessages, groupActivities, taskList, calendarEvents, cbankList succeeded |
| PortfolioApi | userInfo, searchActivityRecords, searchWorks, searchAlbums, categories, notificationsBadge succeeded |
| KarteApi | tests (kind 1), subjectLearningReports, pathways, questionnaires succeeded; testDetail returned HTTP 500 for three distinct IDs returned by tests |

Current-month task lists and activity summaries were empty. The historical month
used by the existing integration tests supplied 19 completed tasks. A completed
task supplied question-section IDs through topicProgress; questionSection was
then exercised with one of those IDs. A missing task returned ClassiError 404.

## Confirmed defects fixed

- `IdApiStatus.old_id` was declared string; myStatuses returned number.
- `StudentTaskSummary.subjectCategory` required id, absent from all 19 returned
  summaries (detail responses still contain id). The summary type now requires
  only name.
- Study currentUser was typed as Training's ClassiUser, promising a school object
  absent from its response. It instead returns assessmentPermitYears. Added and
  exported StudyUser without changing Training's type.
- StudyReportForm required nonexistent subjectLearning and omitted the actual
  subjectLearningReports array and studentMessage. Corrected the response/write
  form shape. No report was saved to validate server-side write acceptance.
- Login continuation includes totp_required; expose it as optional for
  compatibility with responses where it is absent. MFA login was not exercised.
- The README answer example dereferenced nextQuestionSection.id even when null.
  A real completed task returned null. Added guards for empty tasks and no next
  section; no answers were submitted.

Type regression fixtures cover the corrected shapes, including an empty report
array and nullable report values. Existing offline tests cover transport error
handling and CSRF retries without modifying live data.

## Unresolved / untested

- Karte testDetail: three requests returned HTTP 500 with an error_message field.
  The public wrapper correctly surfaces ClassiError. This does not establish
  whether the service endpoint, parameters, or account data caused the error;
  no speculative endpoint change was made.
- answerResult: no answer ID was exposed by the inspected completed-task
  progress response; not called with invented IDs and no answers submitted.
- groupMessages: excluded because message retrieval may implicitly mark messages
  read; its side-effect behavior was not established.
- Excluded state changes: changeUsername, submitAnswers, saveReportForm,
  setTargetGtz, readFeatureBadge, markAllServiceNotificationsRead, addBookmark,
  removeBookmark, markSeen, unmarkSeen.
- No invalid-password live test (avoid lockout), MFA/account-selection flows,
  expired-cookie scenarios, live CSRF write/refresh, alternate Karte kinds or
  pagination exhaustion. Offline regression tests are not live evidence.
- Examples were reviewed but not executed: login prints personal details and
  writes a session file; tasks prints task titles. No UI/visual checks performed.
