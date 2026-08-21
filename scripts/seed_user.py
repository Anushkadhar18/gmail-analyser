from services.backend.app.db import SessionLocal
from services.backend.app import models
import argparse


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    args = parser.parse_args()
    db = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.email == args.email).one_or_none()
        if user:
            print("User already exists:", user.id)
        else:
            user = models.User(email=args.email)
            db.add(user)
            db.commit()
            db.refresh(user)
            print("Created user id", user.id)
    finally:
        db.close()


if __name__ == "__main__":
    main()
