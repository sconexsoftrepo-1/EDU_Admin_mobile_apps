"""Add missing semester subjects/labs without replacing any existing curriculum.

Run from backend: .venv/bin/python tools/seed_course_curricula.py [--apply]
Generated plans are starter drafts, not an accredited or board-approved syllabus.
"""
import argparse
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.core.settings import Settings
from app.core.storage import audit
from app.core.curriculum_workspace import seed_missing
from create_master_data_role import store_for

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply',action='store_true')
    args=parser.parse_args()
    store=store_for(Settings())
    try:
        if args.apply:
            with store.transaction() as data:
                made=seed_missing(data)
                for code in made: audit(data,None,'curriculum_seed','programs',code)
        else:
            data=store.snapshot()
            made=seed_missing(data,apply=False)
        print(('Inserted' if args.apply else 'Would insert')+f' starter curricula for {len(made)} courses.')
        print('Existing curricula were preserved. Generated plans require institution review.')
    finally:
        if hasattr(store,'close'): store.close()
if __name__=='__main__':main()
