// k6 load test: 30 students in one class period — open course, read lessons, complete a lesson,
// submit a quest and take a quiz, all at the same time.
//
//   k6 run -e SUPABASE_URL=https://<ref>.supabase.co -e ANON_KEY=... -e PASSWORD=... \
//          -e COURSE_ID=00000000-0000-4000-c000-000000000001 -e QUIZ_ID=<published quiz id> \
//          --summary-export=results/summary.json tests/load/classroom.js
//
// Run ONLY against a staging project with the dev seed (see README.md). Never against production.
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE = __ENV.SUPABASE_URL;
const ANON = __ENV.ANON_KEY;
const COURSE = __ENV.COURSE_ID || '00000000-0000-4000-c000-000000000001';
const QUIZ = __ENV.QUIZ_ID || '';
const QUEST = __ENV.QUEST_ID || '00000000-0000-4000-e000-000000000001';

export const errors = new Rate('app_errors');
const rpcTime = new Trend('rpc_duration', true);

export const options = {
  scenarios: {
    class_period: {
      executor: 'per-vu-iterations',
      vus: 30, // 30 students at the same time (project target)
      iterations: 1,
      maxDuration: '10m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<800'], // target from PROJECT_SPEC §5
    app_errors: ['rate<0.01'],
    http_req_failed: ['rate<0.01'],
  },
};

function headers(token) {
  return { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}
function ok(res, name) {
  const passed = check(res, { [`${name} 2xx`]: (r) => r.status >= 200 && r.status < 300 });
  errors.add(!passed);
  if (!passed) console.warn(`${name}: ${res.status} ${String(res.body).slice(0, 200)}`);
  return passed;
}
function rpc(token, fn, body, name) {
  const res = http.post(`${BASE}/rest/v1/rpc/${fn}`, JSON.stringify(body), { headers: headers(token), tags: { name } });
  rpcTime.add(res.timings.duration, { fn });
  return res;
}
const think = () => sleep(1 + Math.random() * 3); // students read between actions

export default function () {
  const n = String(__VU).padStart(2, '0');
  let token;
  group('sign in', () => {
    const res = http.post(`${BASE}/auth/v1/token?grant_type=password`,
      JSON.stringify({ email: `student${n}@example.test`, password: __ENV.PASSWORD }),
      { headers: { apikey: ANON, 'Content-Type': 'application/json' }, tags: { name: 'auth' } });
    if (ok(res, 'auth')) token = res.json('access_token');
  });
  if (!token) return;
  const uid = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub;

  group('open course roadmap', () => {
    ok(rpc(token, 'touch_activity', {}, 'touch_activity'), 'touch_activity');
    ok(http.get(`${BASE}/rest/v1/courses?id=eq.${COURSE}&select=id,code,name`, { headers: headers(token), tags: { name: 'course' } }), 'course');
    ok(http.get(`${BASE}/rest/v1/learning_units?course_id=eq.${COURSE}&select=id,position,title,lessons(id,title,position,quest_stage,prerequisite_lesson_id,estimated_minutes)&order=position`,
      { headers: headers(token), tags: { name: 'roadmap' } }), 'roadmap');
    ok(rpc(token, 'my_course_progress', { _course_id: COURSE }, 'progress'), 'progress');
  });
  think();

  group('study a lesson', () => {
    const lesson = '00000000-0000-4000-d000-000000000001';
    ok(http.get(`${BASE}/rest/v1/lessons?id=eq.${lesson}&select=id,title,body_md,lesson_resources(id,type,url,content)`,
      { headers: headers(token), tags: { name: 'lesson' } }), 'lesson');
    think();
    ok(rpc(token, 'complete_lesson', { _lesson_id: lesson }, 'complete_lesson'), 'complete_lesson');
  });

  group('submit a quest', () => {
    ok(http.get(`${BASE}/rest/v1/quests?course_id=eq.${COURSE}&published=eq.true&select=id,title,type,xp_reward`,
      { headers: headers(token), tags: { name: 'quests' } }), 'quests');
    think();
    const res = rpc(token, 'submit_quest', { _quest_id: QUEST, _text: `load test ${uid}`, _url: null, _storage_path: null }, 'submit_quest');
    // a re-run sees CQ_ALREADY_SUBMITTED (400) — that is correct behaviour, not a failure
    const passed = res.status < 300 || String(res.body).includes('CQ_ALREADY_SUBMITTED');
    check(res, { 'submit_quest accepted or already submitted': () => passed });
    errors.add(!passed);
  });

  if (QUIZ) {
    group('take a quiz', () => {
      const start = rpc(token, 'start_quiz_attempt', { _quiz_id: QUIZ }, 'start_quiz');
      if (!ok(start, 'start_quiz')) return;
      const payload = start.json();
      const answers = payload.questions.map((q) =>
        q.type === 'short' ? { question_id: q.id, text: 'internet of things' } : { question_id: q.id, option_id: q.options[0].id });
      sleep(5 + Math.random() * 10);
      ok(rpc(token, 'submit_quiz_attempt', { _attempt_id: payload.attempt_id, _answers: answers }, 'submit_quiz'), 'submit_quiz');
    });
  }
}
