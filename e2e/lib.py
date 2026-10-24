"""Settings the browser checks share. run.py sets them; a file can also be run by hand (see README.md)."""
import os
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
BASE = os.environ.get('E2E_URL', 'http://localhost:5199/')   # where the built site is being served
ART_DIR = REPO / 'assets'                                     # a checkout of the artwork repository
YELLOW = os.environ.get('E2E_YELLOW_SAV') or None             # optional: also check this real Yellow save
