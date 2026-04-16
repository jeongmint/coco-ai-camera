import math
import json
import os
import base64
import urllib.parse
from datetime import datetime, timezone
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

import httpx
from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from database import get_db, init_db
from models import User, CameraSession, Connection, Trace, Message, generate_uuid, utcnow

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(title="COCO - Camera Social Map", lifespan=lifespan)
app.mount("/static", StaticFiles(directory="static"), name="static")

# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    nickname: str = Field(min_length=1, max_length=50)
    language: str = Field(default="ko", max_length=10)

class UserResponse(BaseModel):
    id: str
    nickname: str
    language: str
    profile_visibility: str
    avatar_data: str | None = None

class UpdateUserRequest(BaseModel):
    nickname: str | None = None
    language: str | None = None
    profile_visibility: str | None = None

class ConnectionRequest(BaseModel):
    target_id: str
    type: str = "friend"

class ConnectionResponse(BaseModel):
    id: str
    requester_id: str
    target_id: str
    type: str
    status: str
    requester_nickname: str = ""
    target_nickname: str = ""

class TraceCreate(BaseModel):
    photo_data: str | None = None
    lat: float
    lng: float
    heading: float | None = None
    caption: str | None = None
    visibility: str = "public"

class TraceResponse(BaseModel):
    id: str
    user_id: str
    nickname: str = ""
    photo_data: str | None = None
    lat: float
    lng: float
    heading: float | None = None
    caption: str | None = None
    visibility: str
    created_at: str

class NearbyUserResponse(BaseModel):
    user_id: str
    nickname: str
    lat: float
    lng: float
    mode: str
    distance_m: float
    heading: float | None = None
    avatar_data: str | None = None

class StickerVisionRequest(BaseModel):
    photo_data: str  # data:image/...;base64,...
    prompt: str

class StickerGenerateRequest(BaseModel):
    photo_data: str  # data:image/...;base64,...
    prompt: str

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Return distance in meters between two coordinates."""
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


async def translate_text(text: str, source_lang: str, target_lang: str) -> str:
    """Translate text using MyMemory free API."""
    if source_lang == target_lang:
        return text
    url = "https://api.mymemory.translated.net/get"
    params = {"q": text, "langpair": f"{source_lang}|{target_lang}"}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url, params=params)
            if resp.status_code == 200:
                data = resp.json()
                translated = data.get("responseData", {}).get("translatedText", "")
                if translated:
                    return translated
    except Exception:
        pass
    return text

# ---------------------------------------------------------------------------
# HTML page
# ---------------------------------------------------------------------------

@app.get("/", response_class=HTMLResponse)
async def root():
    return FileResponse("templates/index.html")

# ---------------------------------------------------------------------------
# User response helper
# ---------------------------------------------------------------------------

def _user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        nickname=user.nickname,
        language=user.language,
        profile_visibility=user.profile_visibility,
        avatar_data=user.avatar_data,
    )

# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------

@app.post("/api/auth/register", response_model=UserResponse)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.nickname == req.nickname).first()
    if existing:
        raise HTTPException(400, "이미 사용 중인 닉네임입니다")
    user = User(nickname=req.nickname, language=req.language)
    db.add(user)
    db.commit()
    db.refresh(user)
    return _user_response(user)


@app.post("/api/auth/login", response_model=UserResponse)
def login(req: RegisterRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.nickname == req.nickname).first()
    if not user:
        raise HTTPException(404, "사용자를 찾을 수 없습니다")
    return _user_response(user)

# ---------------------------------------------------------------------------
# User endpoints
# ---------------------------------------------------------------------------

@app.get("/api/users/{user_id}", response_model=UserResponse)
def get_user(user_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "사용자를 찾을 수 없습니다")
    return _user_response(user)


@app.put("/api/users/{user_id}", response_model=UserResponse)
def update_user(user_id: str, req: UpdateUserRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404)
    if req.nickname is not None:
        user.nickname = req.nickname
    if req.language is not None:
        user.language = req.language
    if req.profile_visibility is not None:
        user.profile_visibility = req.profile_visibility
    db.commit()
    db.refresh(user)
    return _user_response(user)


@app.post("/api/users/{user_id}/default-avatar", response_model=UserResponse)
async def default_avatar(user_id: str, db: Session = Depends(get_db)):
    """DiceBear 기반 무료 아바타 자동 생성 (로그인 시 자동 호출)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404)

    style_map = {
        "ko": "adventurer", "ja": "adventurer-neutral",
        "zh": "lorelei", "en": "notionists",
        "es": "fun-emoji", "fr": "lorelei",
    }
    style = style_map.get(user.language, "adventurer")
    colors = "b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf"
    url = f"https://api.dicebear.com/8.x/{style}/png?seed={urllib.parse.quote(user.nickname)}&size=128&backgroundColor={colors}"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                b64 = base64.b64encode(resp.content).decode()
                user.avatar_data = f"data:image/png;base64,{b64}"
                db.commit()
                db.refresh(user)
    except Exception:
        pass  # 실패해도 무시 (아바타 없이 진행)
    return _user_response(user)


@app.post("/api/users/{user_id}/generate-avatar", response_model=UserResponse)
async def generate_avatar(user_id: str, db: Session = Depends(get_db)):
    """DALL-E 기반 AI 아바타 생성 (수동 버튼용, 유료)"""
    if not OPENAI_API_KEY or OPENAI_API_KEY == "여기에_새_API_키를_입력하세요":
        raise HTTPException(503, "OpenAI API 키가 설정되지 않았습니다")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404)

    lang_personality = {
        "ko": "cute Korean style", "en": "friendly Western style",
        "ja": "kawaii Japanese anime style", "zh": "elegant Chinese style",
        "es": "vibrant Latin style", "fr": "chic French style",
    }
    personality = lang_personality.get(user.language, "friendly style")
    prompt = (
        f"A small circular avatar icon for a social app user named '{user.nickname}'. "
        f"{personality}. Colorful, friendly, flat illustration. "
        f"Simple character face, no text, no letters. Clean white background. "
        f"High quality, 256x256."
    )

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/images/generations",
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={"model": "dall-e-2", "prompt": prompt, "n": 1, "size": "256x256", "response_format": "b64_json"},
            )
            if resp.status_code != 200:
                raise HTTPException(502, f"DALL-E 오류: {resp.text[:200]}")
            b64 = resp.json()["data"][0]["b64_json"]
            user.avatar_data = f"data:image/png;base64,{b64}"
            db.commit()
            db.refresh(user)
            return _user_response(user)
    except httpx.TimeoutException:
        raise HTTPException(504, "아바타 생성 시간 초과")

# ---------------------------------------------------------------------------
# Nearby users (HTTP polling fallback)
# ---------------------------------------------------------------------------

@app.get("/api/users/nearby/list", response_model=list[NearbyUserResponse])
def get_nearby_users(
    user_id: str = Query(...),
    lat: float = Query(...),
    lng: float = Query(...),
    radius: float = Query(default=500),
    db: Session = Depends(get_db),
):
    sessions = (
        db.query(CameraSession)
        .filter(
            CameraSession.user_id != user_id,
            CameraSession.is_discoverable == True,
            CameraSession.ended_at == None,
        )
        .all()
    )
    results = []
    for s in sessions:
        if s.lat is None or s.lng is None:
            continue
        dist = haversine(lat, lng, s.lat, s.lng)
        if dist <= radius:
            user = db.query(User).filter(User.id == s.user_id).first()
            if user and user.profile_visibility != "private":
                results.append(NearbyUserResponse(
                    user_id=s.user_id,
                    nickname=user.nickname,
                    lat=s.lat,
                    lng=s.lng,
                    mode=s.mode,
                    distance_m=round(dist, 1),
                ))
    results.sort(key=lambda x: x.distance_m)
    return results

# ---------------------------------------------------------------------------
# Connection endpoints
# ---------------------------------------------------------------------------

@app.post("/api/connections/request", response_model=ConnectionResponse)
def request_connection(req: ConnectionRequest, user_id: str = Query(...), db: Session = Depends(get_db)):
    existing = db.query(Connection).filter(
        or_(
            and_(Connection.requester_id == user_id, Connection.target_id == req.target_id),
            and_(Connection.requester_id == req.target_id, Connection.target_id == user_id),
        ),
        Connection.status != "rejected",
    ).first()
    if existing:
        raise HTTPException(400, "이미 연결 요청이 있습니다")
    conn = Connection(requester_id=user_id, target_id=req.target_id, type=req.type)
    db.add(conn)
    db.commit()
    db.refresh(conn)
    return _conn_response(conn, db)


@app.put("/api/connections/{conn_id}/accept", response_model=ConnectionResponse)
def accept_connection(conn_id: str, db: Session = Depends(get_db)):
    conn = db.query(Connection).filter(Connection.id == conn_id).first()
    if not conn:
        raise HTTPException(404)
    conn.status = "accepted"
    db.commit()
    db.refresh(conn)
    return _conn_response(conn, db)


@app.put("/api/connections/{conn_id}/reject", response_model=ConnectionResponse)
def reject_connection(conn_id: str, db: Session = Depends(get_db)):
    conn = db.query(Connection).filter(Connection.id == conn_id).first()
    if not conn:
        raise HTTPException(404)
    conn.status = "rejected"
    db.commit()
    db.refresh(conn)
    return _conn_response(conn, db)


@app.get("/api/connections", response_model=list[ConnectionResponse])
def list_connections(user_id: str = Query(...), db: Session = Depends(get_db)):
    conns = db.query(Connection).filter(
        or_(Connection.requester_id == user_id, Connection.target_id == user_id)
    ).all()
    return [_conn_response(c, db) for c in conns]


def _conn_response(conn: Connection, db: Session) -> ConnectionResponse:
    req_user = db.query(User).filter(User.id == conn.requester_id).first()
    tgt_user = db.query(User).filter(User.id == conn.target_id).first()
    return ConnectionResponse(
        id=conn.id,
        requester_id=conn.requester_id,
        target_id=conn.target_id,
        type=conn.type,
        status=conn.status,
        requester_nickname=req_user.nickname if req_user else "",
        target_nickname=tgt_user.nickname if tgt_user else "",
    )

# ---------------------------------------------------------------------------
# Trace endpoints
# ---------------------------------------------------------------------------

@app.post("/api/traces", response_model=TraceResponse)
def create_trace(req: TraceCreate, user_id: str = Query(...), db: Session = Depends(get_db)):
    trace = Trace(
        user_id=user_id,
        photo_data=req.photo_data,
        lat=req.lat,
        lng=req.lng,
        heading=req.heading,
        caption=req.caption,
        visibility=req.visibility,
    )
    db.add(trace)
    db.commit()
    db.refresh(trace)
    return _trace_response(trace, db)


@app.get("/api/traces", response_model=list[TraceResponse])
def list_my_traces(user_id: str = Query(...), db: Session = Depends(get_db)):
    traces = db.query(Trace).filter(Trace.user_id == user_id).order_by(Trace.created_at.desc()).all()
    return [_trace_response(t, db) for t in traces]


@app.get("/api/traces/nearby", response_model=list[TraceResponse])
def list_nearby_traces(
    lat: float = Query(...),
    lng: float = Query(...),
    radius: float = Query(default=1000),
    db: Session = Depends(get_db),
):
    traces = db.query(Trace).filter(Trace.visibility == "public").all()
    results = []
    for t in traces:
        dist = haversine(lat, lng, t.lat, t.lng)
        if dist <= radius:
            results.append(_trace_response(t, db))
    return results


@app.get("/api/traces/friends", response_model=list[TraceResponse])
def list_friend_traces(user_id: str = Query(...), db: Session = Depends(get_db)):
    friend_ids = _get_friend_ids(user_id, db)
    traces = (
        db.query(Trace)
        .filter(Trace.user_id.in_(friend_ids), Trace.visibility.in_(["public", "friends"]))
        .order_by(Trace.created_at.desc())
        .all()
    )
    return [_trace_response(t, db) for t in traces]


@app.delete("/api/traces/{trace_id}")
def delete_trace(trace_id: str, user_id: str = Query(...), db: Session = Depends(get_db)):
    trace = db.query(Trace).filter(Trace.id == trace_id, Trace.user_id == user_id).first()
    if not trace:
        raise HTTPException(404)
    db.delete(trace)
    db.commit()
    return {"ok": True}


def _trace_response(trace: Trace, db: Session) -> TraceResponse:
    user = db.query(User).filter(User.id == trace.user_id).first()
    return TraceResponse(
        id=trace.id,
        user_id=trace.user_id,
        nickname=user.nickname if user else "",
        photo_data=trace.photo_data,
        lat=trace.lat,
        lng=trace.lng,
        heading=trace.heading,
        caption=trace.caption,
        visibility=trace.visibility,
        created_at=trace.created_at.isoformat() if trace.created_at else "",
    )


def _get_friend_ids(user_id: str, db: Session) -> list[str]:
    conns = db.query(Connection).filter(
        or_(Connection.requester_id == user_id, Connection.target_id == user_id),
        Connection.status == "accepted",
    ).all()
    ids = set()
    for c in conns:
        if c.requester_id == user_id:
            ids.add(c.target_id)
        else:
            ids.add(c.requester_id)
    return list(ids)

# ---------------------------------------------------------------------------
# WebSocket – nearby discovery
# ---------------------------------------------------------------------------

class NearbyManager:
    def __init__(self):
        self.active: dict[str, dict] = {}  # user_id -> {ws, lat, lng, heading, nickname, mode, avatar_data}

    async def connect(self, user_id: str, ws: WebSocket, nickname: str, mode: str, avatar_data: str | None = None):
        await ws.accept()
        self.active[user_id] = {"ws": ws, "lat": None, "lng": None, "heading": None, "nickname": nickname, "mode": mode, "avatar_data": avatar_data}

    def disconnect(self, user_id: str):
        self.active.pop(user_id, None)

    def update_location(self, user_id: str, lat: float, lng: float, heading: float | None = None):
        if user_id in self.active:
            self.active[user_id]["lat"] = lat
            self.active[user_id]["lng"] = lng
            self.active[user_id]["heading"] = heading

    def get_nearby(self, user_id: str, radius: float = 500) -> list[dict]:
        me = self.active.get(user_id)
        if not me or me["lat"] is None:
            return []
        results = []
        for uid, data in self.active.items():
            if uid == user_id or data["lat"] is None:
                continue
            dist = haversine(me["lat"], me["lng"], data["lat"], data["lng"])
            if dist <= radius:
                results.append({
                    "user_id": uid,
                    "nickname": data["nickname"],
                    "lat": data["lat"],
                    "lng": data["lng"],
                    "heading": data.get("heading"),
                    "mode": data["mode"],
                    "distance_m": round(dist, 1),
                    "avatar_data": data.get("avatar_data"),
                })
        results.sort(key=lambda x: x["distance_m"])
        return results


nearby_manager = NearbyManager()


@app.websocket("/ws/nearby/{user_id}")
async def ws_nearby(ws: WebSocket, user_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    nickname = user.nickname if user else "Unknown"
    avatar_data = user.avatar_data if user else None
    await nearby_manager.connect(user_id, ws, nickname, "normal", avatar_data)

    # Create camera session in DB
    session = CameraSession(user_id=user_id, is_discoverable=True)
    db.add(session)
    db.commit()

    try:
        while True:
            data = await ws.receive_json()
            action = data.get("action")

            if action == "update_location":
                lat = data.get("lat")
                lng = data.get("lng")
                heading = data.get("heading")
                mode = data.get("mode", "normal")
                nearby_manager.update_location(user_id, lat, lng, heading)
                nearby_manager.active[user_id]["mode"] = mode
                # Update DB session
                session.lat = lat
                session.lng = lng
                session.mode = mode
                db.commit()
                # Send nearby users back
                nearby = nearby_manager.get_nearby(user_id)
                await ws.send_json({"type": "nearby_users", "users": nearby})

            elif action == "ping":
                nearby = nearby_manager.get_nearby(user_id)
                await ws.send_json({"type": "nearby_users", "users": nearby})

    except WebSocketDisconnect:
        nearby_manager.disconnect(user_id)
        session.ended_at = utcnow()
        db.commit()

# ---------------------------------------------------------------------------
# WebSocket – chat with translation
# ---------------------------------------------------------------------------

class ChatManager:
    def __init__(self):
        self.rooms: dict[str, list[dict]] = {}  # session_id -> [{user_id, ws, language}]

    async def join(self, session_id: str, user_id: str, ws: WebSocket, language: str, nickname: str):
        await ws.accept()
        if session_id not in self.rooms:
            self.rooms[session_id] = []
        self.rooms[session_id].append({"user_id": user_id, "ws": ws, "language": language, "nickname": nickname})
        # Notify others
        for member in self.rooms[session_id]:
            if member["user_id"] != user_id:
                try:
                    await member["ws"].send_json({
                        "type": "system",
                        "message": f"{nickname}님이 입장했습니다",
                    })
                except Exception:
                    pass

    def leave(self, session_id: str, user_id: str):
        if session_id in self.rooms:
            self.rooms[session_id] = [m for m in self.rooms[session_id] if m["user_id"] != user_id]
            if not self.rooms[session_id]:
                del self.rooms[session_id]

    async def broadcast(self, session_id: str, sender_id: str, sender_nickname: str, text: str, source_lang: str, db: Session):
        if session_id not in self.rooms:
            return
        for member in self.rooms[session_id]:
            target_lang = member["language"]
            translated = await translate_text(text, source_lang, target_lang)

            # Save message
            msg = Message(
                session_id=session_id,
                sender_id=sender_id,
                original_text=text,
                translated_text=translated,
                language_code=source_lang,
            )
            db.add(msg)

            try:
                await member["ws"].send_json({
                    "type": "message",
                    "sender_id": sender_id,
                    "sender_nickname": sender_nickname,
                    "original_text": text,
                    "translated_text": translated,
                    "source_lang": source_lang,
                    "target_lang": target_lang,
                })
            except Exception:
                pass
        db.commit()


chat_manager = ChatManager()


@app.websocket("/ws/chat/{session_id}")
async def ws_chat(ws: WebSocket, session_id: str, user_id: str = Query(...), language: str = Query(default="ko"), nickname: str = Query(default="Unknown"), db: Session = Depends(get_db)):
    await chat_manager.join(session_id, user_id, ws, language, nickname)
    try:
        while True:
            data = await ws.receive_json()
            action = data.get("action")
            if action == "send":
                text = data.get("text", "")
                if text.strip():
                    await chat_manager.broadcast(session_id, user_id, nickname, text, language, db)
    except WebSocketDisconnect:
        chat_manager.leave(session_id, user_id)
        # Notify others
        if session_id in chat_manager.rooms:
            for member in chat_manager.rooms[session_id]:
                try:
                    await member["ws"].send_json({
                        "type": "system",
                        "message": f"{nickname}님이 퇴장했습니다",
                    })
                except Exception:
                    pass


# ---------------------------------------------------------------------------
# Chat history
# ---------------------------------------------------------------------------

@app.get("/api/chat/{session_id}/messages")
def get_chat_messages(session_id: str, db: Session = Depends(get_db)):
    messages = db.query(Message).filter(Message.session_id == session_id).order_by(Message.created_at).all()
    return [
        {
            "id": m.id,
            "sender_id": m.sender_id,
            "original_text": m.original_text,
            "translated_text": m.translated_text,
            "language_code": m.language_code,
            "created_at": m.created_at.isoformat() if m.created_at else "",
        }
        for m in messages
    ]


# ---------------------------------------------------------------------------
# Explore – AI Place Recommendation
# ---------------------------------------------------------------------------

class ExploreRecommendation(BaseModel):
    type: str          # "my_style" | "friend_vibe" | "mood"
    title: str
    description: str
    suggestions: list[dict]  # [{lat, lng, label, reason, emoji}]


@app.get("/api/explore/recommend", response_model=list[ExploreRecommendation])
async def explore_recommend(
    user_id: str = Query(...),
    lat: float = Query(...),
    lng: float = Query(...),
    db: Session = Depends(get_db),
):
    if not OPENAI_API_KEY or OPENAI_API_KEY == "여기에_새_API_키를_입력하세요":
        raise HTTPException(503, "OpenAI API 키가 설정되지 않았습니다")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404)

    # --- 1. 내 흔적 수집 (최근 4개)
    my_traces = (
        db.query(Trace)
        .filter(Trace.user_id == user_id)
        .order_by(Trace.created_at.desc())
        .limit(4)
        .all()
    )

    # --- 2. 친구 흔적 수집 (최근 1개, 반경 5km)
    friend_ids = _get_friend_ids(user_id, db)
    friend_traces = []
    if friend_ids:
        all_friend_traces = (
            db.query(Trace)
            .filter(
                Trace.user_id.in_(friend_ids),
                Trace.visibility.in_(["public", "friends"]),
            )
            .order_by(Trace.created_at.desc())
            .limit(20)
            .all()
        )
        for t in all_friend_traces:
            if haversine(lat, lng, t.lat, t.lng) <= 5000:
                friend_traces.append(t)
                if len(friend_traces) >= 1:
                    break

    # --- 3. 공개 흔적 (반경 3km)
    public_traces = []
    all_public = db.query(Trace).filter(Trace.visibility == "public").all()
    for t in all_public:
        if t.user_id != user_id and haversine(lat, lng, t.lat, t.lng) <= 3000:
            public_traces.append(t)
            if len(public_traces) >= 10:
                break

    def trace_summary(traces: list) -> str:
        if not traces:
            return "없음"
        items = []
        for t in traces:
            cap = t.caption or "메모 없음"
            items.append(f"- 위치({t.lat:.4f},{t.lng:.4f}) 메모: {cap[:50]}")
        return "\n".join(items)

    now_kst = datetime.now(timezone.utc)
    hour = now_kst.hour
    if 5 <= hour < 11:
        time_context = "아침 (5~11시): 조용한 카페, 공원 산책, 조식"
    elif 11 <= hour < 14:
        time_context = "점심 (11~14시): 맛집, 브런치, 광장"
    elif 14 <= hour < 18:
        time_context = "오후 (14~18시): 카페, 갤러리, 쇼핑"
    elif 18 <= hour < 22:
        time_context = "저녁 (18~22시): 레스토랑, 야경, 술집"
    else:
        time_context = "밤 (22시~): 야경 포인트, 편의점, 심야 카페"

    has_my = bool(my_traces)
    has_friends = bool(friend_traces)

    my_style_hint = "흔적이 없으므로 위치 주변의 인기 있는 일반적인 장소를 추천하세요." if not has_my else "내 흔적 패턴을 분석해 취향에 맞는 장소를 추천하세요."
    friend_hint = "친구 흔적이 없으므로 현재 위치 주변에서 사람들이 즐겨 찾는 감성적인 장소를 추천하세요." if not has_friends else "친구 흔적 분위기와 비슷한 장소를 추천하세요."

    prompt = f"""당신은 위치 기반 SNS "COCO"의 AI 탐험 큐레이터입니다.
사용자의 현재 위치: 위도 {lat:.4f}, 경도 {lng:.4f}
사용자 언어: {user.language}
현재 시간대: {time_context}

[내 흔적] ({my_style_hint})
{trace_summary(my_traces)}

[친구 흔적] ({friend_hint})
{trace_summary(friend_traces)}

[근처 공개 흔적]
{trace_summary(public_traces)}

위 정보를 바탕으로 아래 3가지 유형의 탐험 추천을 JSON으로 반환하십시오.
- 흔적이 없는 경우에도 반드시 현재 위치({lat:.4f},{lng:.4f}) 반경 1km 내 실제 방문 가능한 장소 2~3개를 추천하세요.
- 현재 위치에서 도보로 이동 가능한 실제 좌표를 생성하세요 (위도/경도를 ±0.003~0.008 범위로 조정).
- 시간대({time_context})를 반드시 반영하세요.

반드시 아래 JSON 형식만 반환하십시오 (설명 없이):
[
  {{
    "type": "my_style",
    "title": "당신이 좋아할 다음 장소",
    "description": "한 줄 설명",
    "suggestions": [
      {{"lat": {lat:.4f}, "lng": {lng:.4f}, "label": "장소명", "reason": "추천 이유 한 줄", "emoji": "🌸"}}
    ]
  }},
  {{
    "type": "friend_vibe",
    "title": "이 근처 감성 스팟",
    "description": "한 줄 설명",
    "suggestions": [...]
  }},
  {{
    "type": "mood",
    "title": "지금 이 시간에 딱 맞는 곳",
    "description": "한 줄 설명",
    "suggestions": [...]
  }}
]"""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-4o-mini",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.8,
                    "response_format": {"type": "json_object"},
                },
            )
            if resp.status_code != 200:
                raise HTTPException(502, f"GPT 오류: {resp.text[:200]}")

            content = resp.json()["choices"][0]["message"]["content"]
            # json_object mode wraps in object — handle both array and {list:...}
            parsed = json.loads(content)
            if isinstance(parsed, list):
                recs = parsed
            else:
                recs = next(iter(parsed.values()))  # unwrap first key

            return [ExploreRecommendation(**r) for r in recs[:3]]

    except httpx.TimeoutException:
        raise HTTPException(504, "AI 추천 생성 시간 초과")
    except (KeyError, json.JSONDecodeError) as e:
        raise HTTPException(502, f"응답 파싱 오류: {e}")


# ---------------------------------------------------------------------------
# Sticker API (time-camera-ai integration)
# ---------------------------------------------------------------------------

@app.post("/api/sticker/vision")
async def sticker_vision(req: StickerVisionRequest):
    """GPT-4o Vision으로 사진 속 인물/사물 묘사 추출"""
    if not OPENAI_API_KEY:
        raise HTTPException(503, "OpenAI API 키가 설정되지 않았습니다")
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "gpt-4o",
                "max_tokens": 400,
                "messages": [{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": req.prompt},
                        {"type": "image_url", "image_url": {"url": req.photo_data, "detail": "low"}},
                    ],
                }],
            },
        )
        if resp.status_code != 200:
            raise HTTPException(502, f"Vision 오류: {resp.text[:200]}")
        description = resp.json()["choices"][0]["message"]["content"]
        return {"description": description}


@app.post("/api/sticker/generate")
async def sticker_generate(req: StickerGenerateRequest):
    """gpt-image-1.5로 투명 PNG 스티커 생성"""
    if not OPENAI_API_KEY:
        raise HTTPException(503, "OpenAI API 키가 설정되지 않았습니다")
    try:
        _, b64 = req.photo_data.split(",", 1)
        img_bytes = base64.b64decode(b64)
    except Exception:
        raise HTTPException(400, "photo_data 형식이 올바르지 않습니다")

    async with httpx.AsyncClient(timeout=90.0) as client:
        resp = await client.post(
            "https://api.openai.com/v1/images/edits",
            headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
            files={"image[]": ("photo.png", img_bytes, "image/png")},
            data={
                "model": "gpt-image-1.5",
                "prompt": req.prompt,
                "n": "1",
                "size": "1024x1024",
                "quality": "high",
                "background": "transparent",
                "output_format": "png",
            },
        )
        if resp.status_code != 200:
            raise HTTPException(502, f"스티커 생성 실패: {resp.text[:300]}")
        b64_result = resp.json()["data"][0]["b64_json"]
        return {"sticker_data": f"data:image/png;base64,{b64_result}"}


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
