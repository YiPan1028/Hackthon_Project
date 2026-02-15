import os
import math
import hashlib
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from sqlalchemy import create_engine, Integer, String, DateTime, Text, Float, desc
from sqlalchemy.orm import sessionmaker, DeclarativeBase, Mapped, mapped_column, Session

# Load environment variables
load_dotenv(".env.local")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    # DATABASE_URL = "postgresql+psycopg2://lovecare_user:password@localhost:5432/lovecare"
    DATABASE_URL= "postgresql+psycopg2://lovecare_user:Py20041028@10.69.xxx.xxx:5432/lovecare"

engine = create_engine(DATABASE_URL, pool_pre_ping=True)


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


class MoodLog(Base):
    __tablename__ = "mood_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_email: Mapped[str] = mapped_column(String(255), index=True)
    day: Mapped[int] = mapped_column(Integer, index=True)
    mood: Mapped[int] = mapped_column(Integer)
    stress: Mapped[int] = mapped_column(Integer)
    energy: Mapped[int] = mapped_column(Integer)
    sleep: Mapped[float] = mapped_column(Float)
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


# ---------------- Schemas ----------------
class DailyLogSchema(BaseModel):
    day: int
    mood: int
    stress: int
    energy: int
    sleep: float
    reflection: str = ""


class AnalysisRequest(BaseModel):
    email: str
    logs: List[DailyLogSchema]


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=6)


class LoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=6)


class UpsertLogRequest(BaseModel):
    email: str
    log: DailyLogSchema


# ---------------- App ----------------
app = FastAPI()

from fastapi.middleware.cors import CORSMiddleware

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+):3001$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.get("/")
def health():
    return {"status": "ok"}


@app.post("/auth/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    exists = db.query(User).filter(User.email == req.email).first()
    if exists:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(email=req.email, password_hash=hash_password(req.password))
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "status": "success",
        "user": {"id": user.id, "email": user.email, "created_at": user.created_at.isoformat()},
    }


@app.post("/auth/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or user.password_hash != hash_password(req.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return {
        "status": "success",
        "token": "love-care-token-2024",
        "user": {"email": user.email, "name": user.email.split("@")[0]},
    }


# ✅ 1) 保存/覆盖某一天（前端每次点 Save 就调这个）
@app.post("/logs/upsert")
def upsert_day_log(req: UpsertLogRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not registered. Please register first.")

    l = req.log
    db_log = MoodLog(
        user_email=req.email,
        day=l.day,
        mood=l.mood,
        stress=l.stress,
        energy=l.energy,
        sleep=l.sleep,
        note=l.reflection,
    )
    db.add(db_log)
    db.commit()

    return {"status": "success"}


# ✅ 2) 拉取一周：每个 day 取最新一条（用于“登录后自动回显”）
@app.get("/logs/week")
def get_week_logs(email: str = Query(...), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not registered. Please register first.")

    logs_out = []
    for day in range(1, 8):
        row = (
            db.query(MoodLog)
            .filter(MoodLog.user_email == email, MoodLog.day == day)
            .order_by(desc(MoodLog.created_at))
            .first()
        )
        if row:
            logs_out.append(
                {
                    "day": row.day,
                    "mood": row.mood,
                    "stress": row.stress,
                    "energy": row.energy,
                    "sleep": row.sleep,
                    "reflection": row.note or "",
                }
            )

    return {"status": "success", "logs": logs_out}


@app.post("/analysis/calculate")
def calculate_metrics(req: AnalysisRequest, db: Session = Depends(get_db)):
    logs = req.logs
    if len(logs) < 2:
        raise HTTPException(status_code=400, detail="Insufficient data")

    user = db.query(User).filter(User.email == req.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not registered. Please register first.")

    # （可选）你也可以在这里不存库了；存库改走 /logs/upsert 更干净
    # 如果你想保留这里的存库，也可以，但容易重复写很多行。
    # 我建议：calculate只算，不写库。

    moods = [l.mood for l in logs]
    mean_mood = sum(moods) / len(moods)
    variance = sum((x - mean_mood) ** 2 for x in moods) / len(moods)
    std_dev = math.sqrt(variance)

    jumps = sum(abs(moods[i] - moods[i - 1]) for i in range(1, len(moods)))
    avg_jump = jumps / (len(moods) - 1)
    volatility = min(100, (std_dev * 15) + (avg_jump * 10))

    accumulation = []
    curr = 0
    for l in logs:
        curr = (0.8 * curr) + l.stress
        accumulation.append(round(curr, 2))

    avg_stress = sum(l.stress for l in logs) / len(logs)
    avg_sleep = sum(l.sleep for l in logs) / len(logs)
    avg_energy = sum(l.energy for l in logs) / len(logs)

    sleep_deficit = max(0, 8 - avg_sleep) / 8
    energy_depletion = (10 - avg_energy) / 10
    burnout = min(100, (avg_stress * 8) + (sleep_deficit * 20) + (energy_depletion * 20))

    battery = min(100, (avg_energy * 5) + (avg_sleep * 5) + (logs[-1].mood * 2))
    balance = min(100, max(0, 100 - (avg_stress * 7) + (mean_mood * 3)))

    risk = "STABLE"
    if burnout > 70 or (volatility > 80 and burnout > 40):
        risk = "HIGH_RISK"
    elif burnout > 40 or volatility > 50:
        risk = "CAUTION"

    return {
        "volatilityScore": volatility,
        "stressAccumulation": accumulation,
        "burnoutLikelihood": burnout,
        "riskLevel": risk,
        "emotionalBattery": battery,
        "loveStressBalance": balance,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
