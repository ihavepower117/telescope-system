const SUPABASE_URL =
    "https://umzmuvbtqljdmmvpdxvo.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_U_e7cvUckiHK_d9FbjFwBQ_UCJ4wpwI";

const sb = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const telescopeNames = {
    1: "PlaneWave CDK17",
    2: "PlaneWave CDK12.5"
};

/* ===================== */
/* 시간 */
/* ===================== */

function formatTime(date) {
    const d = new Date(date);
    return d.getFullYear() + "-" +
        String(d.getMonth() + 1).padStart(2, "0") + "-" +
        String(d.getDate()).padStart(2, "0") + " " +
        String(d.getHours()).padStart(2, "0") + ":" +
        String(d.getMinutes()).padStart(2, "0");
}

function getDateOnly(date) {
    const d = new Date(date);
    return d.toISOString().split("T")[0];
}

/* ===================== */
/* 초기 로딩 */
/* ===================== */

async function loadAll() {
    await loadTelescopes();
    await loadTodayLogs();
    await cleanupOldLogs(); // 🧹 자동 삭제
}

/* ===================== */
/* 망원경 상태 */
/* ===================== */

async function loadTelescopes() {

    const { data } = await sb.from("telescopes").select("*");

    data.forEach(t => {

        const status = document.getElementById(`status${t.id}`);
        const current = document.getElementById(`current${t.id}`);

        if (t.status === "free") {
            status.innerHTML = "🟢 사용 가능";
            current.innerHTML = "";
        } else {
            status.innerHTML = "🔴 사용 중";
            current.innerHTML =
                `사용자: ${t.student_id} ${t.student_name}<br>
                 시작: ${formatTime(t.start_time)}`;
        }
    });
}

/* ===================== */
/* 시작 (충돌 방지) */
/* ===================== */

async function startUse(id) {

    const studentId = document.getElementById(`startId${id}`).value;
    const studentName = document.getElementById(`startName${id}`).value;

    if (!studentId || !studentName) return alert("입력 필요");

    const now = new Date();

    const { data } = await sb
        .from("telescopes")
        .update({
            status: "occupied",
            student_id: studentId,
            student_name: studentName,
            start_time: now.toISOString()
        })
        .eq("id", id)
        .eq("status", "free")
        .select();

    if (!data || data.length === 0) {
        return alert("이미 사용 중");
    }

    await sb.from("usage_logs").insert({
        telescope_id: id,
        telescope_name: telescopeNames[id],
        student_id: studentId,
        student_name: studentName,
        start_time: now.toISOString(),
        end_time: null
    });

    loadAll();
}

/* ===================== */
/* 종료 */
/* ===================== */

async function finishUse(id) {

    const studentId = document.getElementById(`endId${id}`).value;
    const studentName = document.getElementById(`endName${id}`).value;

    const { data } = await sb
        .from("telescopes")
        .select("*")
        .eq("id", id)
        .single();

    if (data.student_id !== studentId || data.student_name !== studentName) {
        return alert("불일치");
    }

    const now = new Date();

    await sb.from("telescopes").update({
        status: "free",
        student_id: null,
        student_name: null,
        start_time: null
    }).eq("id", id);

    await sb.from("usage_logs")
        .update({ end_time: now.toISOString() })
        .eq("telescope_id", id)
        .eq("student_id", studentId)
        .is("end_time", null);

    loadAll();
}

/* ===================== */
/* 오늘 기록 */
/* ===================== */

async function loadTodayLogs() {

    const { data } = await sb
        .from("usage_logs")
        .select("*")
        .order("id", { ascending: false });

    [1, 2].forEach(id => {

        const box = document.getElementById(`log${id}`);
        const logs = data.filter(l => l.telescope_id === id);

        box.innerHTML = logs.map(l => `
            ${l.student_id} ${l.student_name}<br>
            ${formatTime(l.start_time)} ~ ${l.end_time ? formatTime(l.end_time) : "사용 중"}
            <hr>
        `).join("");
    });
}

/* ===================== */
/* 날짜 조회 (별도 영역) */
/* ===================== */

async function loadHistory(date = null) {

    const { data } = await sb.from("usage_logs").select("*");

    [1, 2].forEach(id => {

        let logs = data.filter(l => l.telescope_id === id);

        if (date) {
            logs = logs.filter(l => getDateOnly(l.start_time) === date);
        }

        const box = document.getElementById(`history${id}`);

        box.innerHTML = logs.map(l => `
            ${l.student_id} ${l.student_name}<br>
            ${formatTime(l.start_time)} ~ ${l.end_time ? formatTime(l.end_time) : "사용 중"}
            <hr>
        `).join("") || "기록 없음";
    });
}

function filterByDate() {
    const date = document.getElementById("datePicker").value;
    if (!date) return alert("날짜 선택");
    loadHistory(date);
}

/* ===================== */
/* 🧹 1달 지난 데이터 자동 삭제 */
/* ===================== */

async function cleanupOldLogs() {

    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    await sb
        .from("usage_logs")
        .delete()
        .lt("start_time", oneMonthAgo.toISOString());
}

/* ===================== */
/* 실행 */
/* ===================== */

loadAll();