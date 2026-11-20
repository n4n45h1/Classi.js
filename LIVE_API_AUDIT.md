# Live API audit

Safe calls were made with the provisioned account using `ClassiClient.login()`.
No credentials, session data, or personal response values are retained here.
Responses were inspected by field names, primitive types and array lengths only.

## HAR-driven read additions

Compared endpoint and field names with the owner's offline HAR, then verified
using the provisioned test account through `ClassiClient.login()` and
`ClassiClient.fromSession()`. No owner-account IDs, cookies, tokens, personal
values or returned destination URLs were copied into source or fixtures.
All new fixtures are synthetic.

After login a fetch guard allowed GETs and the existing read-only portfolio
search POST only. Discovery IDs came from the test account's live lists and
account information, never from the HAR. No questionnaire was started, saved
or submitted; no bookmarks, read markers or other state changes were sent.
The Benesse resolver returned JSON through a plain GET; its returned URL was
not logged, saved, opened or followed.

New method results:

- IdApi.schoolLoginOptions: HTTP 200; unwraps the ID success/data envelope.
- PlatformApi.assignedQuestionnaires: HTTP 200.
- PlatformApi.answeredQuestionnaires: HTTP 200.
- PlatformApi.questionnaireInfo: HTTP 200 with IDs from the assigned list.
- PlatformApi.questionnaireDetail: HTTP 403 for an assigned questionnaire;
  HTTP 401 for an already answered questionnaire. No successful test-account
  detail response was obtained. The route and declared success shape come
  from the HAR's HTTP 200 response. No attempt/header was created to bypass
  access restrictions; no change to CSRF behavior was attempted. Whether
  attempt state, permissions or headers explain these statuses is unverified.
- PlatformApi.bookmarks: HTTP 200; the HAR sample was empty, so elements
  remain unknown.
- PortfolioApi.activityRecord: HTTP 200, ID discovered by read-only search.
- PortfolioApi.templates: HTTP 200.
- PortfolioApi.marks: HTTP 200.
- PortfolioApi.graduationMessageStatus: HTTP 200.
- KarteApi.trainingBenesseTestUrl: HTTP 200.

Existing wrapper extensions:

- PlatformApi.groups(year) and newMessages(year): HTTP 200 each; year obtained
  from groupYears. Omitting year preserves the old route.
- KarteApi.tests with classroom_id and pathways with classrooms_id:
  HTTP 200 each; classroom obtained from test-account platform user info.
- KarteApi.testDetail now accepts optional name, exam_date,
  national_display_code, prefecture_display_code, school_display_code and
  gtz_output_flg. Query values are encoded; omitting the object preserves the
  old request. One Benesse exam discovered through tests(kind 3) returned
  HTTP 200 **both without and with metadata**. A regular test discovered
  through tests(kind 1), using the original signature, still returned HTTP 500.
  Thus the metadata option does not establish a fix for the earlier 500s;
  the regular-test failure remains unresolved. No endpoint was replaced.
- KarteTestSummary now accepts numeric/string kind and optional regular-test
  fields or bc_results.exam. Existing method positional arguments remain
  valid; callers accessing labels/kind must handle their absence.

The HAR shows platform x-xsrf-token and, on selected writes, x-csrf-token
obtained from GET /api/v2/csrf/token. Existing write wrappers omit that flow.
**Unverified:** whether otherwise identical header-free library writes fail.
No CSRF acquisition wrapper or write behavior was changed, and no live write
control was attempted. Analytics and badge-notify routes were not added.

Offline route tests cover GET-only behavior, no request bodies or new CSRF
headers, defaults, optional filters, query/path encoding, empty responses and
HTTP errors. Declaration fixtures cover both Karte result families and the
new response types. README examples were not visually rendered for this change.

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

The coverage above records the initial audit. The read-API expansion below was
verified separately against the same provisioned account.

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

## Read-API expansion

Logged in with the library's own login. A fetch allowlist rejected every
non-GET request after login except talkroom search and the video GraphQL query
endpoint. No messages, answers, read markers, badge events or report updates
were sent. CSRF headers and the shared HTTP transport were not changed.

| Service | Newly verified methods | Live result |
| --- | --- | --- |
| Training | todayMissions, missions, mission, thisWeekDailyMission, todayDailyMission | HTTP 200 each; detail IDs obtained from missions |
| Training | weeklyReport, dailyMissionRecords | HTTP 200 each for ISO year 2026, week 45; initial current-week requests returned 400; no wrapper change was needed |
| Training | recommendedStudentTask | HTTP 200; studentTask was null, so its type remains unknown |
| Training | careerTrainingCategories (koumuin and shushoku), qualificationTrainingCategories | HTTP 200 for all three category routes |
| Training | koumuinQuestionSections | HTTP 200; unit ID obtained from koumuin categories |
| Study | unrecordedUsers | HTTP 200 |
| Platform | webtestExaminations, webtestResults, searchTalkrooms | HTTP 200 each; empty lists, element types remain unknown |
| Platform | cbankStat, groupYears, subjectList, schoolageList, questionnaireCategories | HTTP 200 each |
| Platform | calendarEvents with event_type | HTTP 200; existing two-argument signature retained |
| Portfolio | spaces, stories, storyCategories, storyComments | HTTP 200 each; empty spaces/stories/comments retain unknown element types |
| Video | videosByCategory, video | HTTP 200 each with GraphQL data and no errors; video ID obtained from list |

The platform talkroom search succeeded as a bodyless POST without any CSRF
header. No new CSRF mechanism was added. Pagination and calendar query encoding
are covered offline; live pagination exhaustion was not attempted.

Kuroko was checked before adding VideoApi: a restored library session obtained
both category results and a video's expiring embedding. An anonymous control
request returned HTTP 200 with GraphQL errors and no category data. This confirms
that the existing cookie session authenticates these read queries without a
separate token. The public training frontend supplied the VideoCategory enum
values; introspection is disabled. Initial schema probes returned validation
errors before using the frontend's enum spelling. No GraphQL mutations were sent.

GroupMessages.group now uses GroupDetail rather than GroupSummary. The browser
capture showed member_count and restriction flags, but no unread or sort_no.
The corrected declaration fixture rejects access to those summary-only fields.
Group messages were not fetched again in this expansion.

All new response types are exported. Declaration fixtures cover observed shapes;
offline tests cover request routes/defaults, empty responses, HTTP errors,
session restoration, GraphQL errors and cursor variables. Null-only or empty
samples do not establish nonempty payload fields: those remain unknown.

Partner, analytics/GA4, badge notifications and Karte were deliberately left
unchanged. No write wrappers were added. The standalone Karte testDetail 500
remains unresolved; the UI uses embedded io_results from the tests list.
No UI rendering changes were made; README rendering was not visually checked.
