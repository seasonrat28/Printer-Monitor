import sys
sys.path.append('.')
from app.db.session import SessionLocal
from app.api.endpoints.printers import get_dashboard_summary

def test():
    db = SessionLocal()
    try:
        res = get_dashboard_summary(db)
        print("Success:", res)
    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test()
