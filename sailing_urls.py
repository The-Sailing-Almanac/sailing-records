import httpx
from bs4 import BeautifulSoup
import sqlite3
import time
import sys

# --- CONFIGURATION ---
DB_NAME = 'sailing_urls.db'
SLEEP_TIME = 0.2  # Seconds between requests
YACHT_SCORING_START = 1
YACHT_SCORING_MAX = 60000  # Adjust as the years go on

def setup_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    # Registry tracks the URLs we find
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS registry (
            url TEXT PRIMARY KEY,
            platform TEXT,
            event_name TEXT,
            status TEXT DEFAULT 'pending'
        )
    ''')
    # State tracks our progress so we can resume
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS scraper_state (
            platform TEXT PRIMARY KEY,
            last_id_processed INTEGER
        )
    ''')
    conn.commit()
    return conn

def get_last_id(conn, platform):
    cursor = conn.cursor()
    cursor.execute("SELECT last_id_processed FROM scraper_state WHERE platform = ?", (platform,))
    row = cursor.fetchone()
    return row[0] if row else None

def update_last_id(conn, platform, last_id):
    cursor = conn.cursor()
    cursor.execute("INSERT OR REPLACE INTO scraper_state (platform, last_id_processed) VALUES (?, ?)", 
                   (platform, last_id))
    conn.commit()

# --- SPIDERS ---

def harvest_icsa(conn):
    """ICSA Techscore: Crawls by Season"""
    print("[-] Harvesting ICSA Techscore...")
    base_url = "https://scores.collegesailing.org"
    try:
        response = httpx.get(f"{base_url}/seasons/", timeout=10.0)
        soup = BeautifulSoup(response.text, 'html.parser')
        seasons = [a['href'] for a in soup.select('ul.season-list a')]
        
        for season in seasons:
            print(f"    Checking season: {season}")
            s_resp = httpx.get(f"{base_url}{season}")
            s_soup = BeautifulSoup(s_resp.text, 'html.parser')
            links = s_soup.select('table.results-list tbody tr td.name a')
            for link in links:
                regatta_url = f"{base_url}{link['href']}"
                conn.execute("INSERT OR IGNORE INTO registry (url, platform, event_name) VALUES (?, ?, ?)", 
                             (regatta_url, 'ICSA', link.text.strip()))
            conn.commit()
            time.sleep(SLEEP_TIME)
    except Exception as e:
        print(f"Error harvesting ICSA: {e}")

def harvest_yachtscoring(conn):
    """Yacht Scoring: Probes sequential EIDs with Resume capability"""
    start_id = get_last_id(conn, 'YachtScoring') or YACHT_SCORING_START
    print(f"[-] Resuming Yacht Scoring at ID {start_id}...")

    with httpx.Client(follow_redirects=True, timeout=5.0) as client:
        for eid in range(start_id, YACHT_SCORING_MAX):
            url = f"https://www.yachtscoring.com/emenu.cfm?eID={eid}"
            try:
                # HEAD is faster to check existence
                resp = client.head(url)
                if resp.status_code == 200:
                    # Optional: GET the title for the DB
                    full_resp = client.get(url)
                    soup = BeautifulSoup(full_resp.text, 'html.parser')
                    title = soup.title.text.split('-')[0].strip() if soup.title else f"Event {eid}"
                    
                    conn.execute("INSERT OR IGNORE INTO registry (url, platform, event_name) VALUES (?, ?, ?)", 
                                 (url, 'YachtScoring', title))
                    print(f" [!] Found: {title} (ID {eid})")
                
                # Update progress every ID (or every 10 for speed)
                if eid % 10 == 0:
                    update_last_id(conn, 'YachtScoring', eid)
                    
                time.sleep(SLEEP_TIME)
            except KeyboardInterrupt:
                update_last_id(conn, 'YachtScoring', eid)
                print("\n[!] Paused by user. Progress saved.")
                sys.exit()
            except Exception:
                continue

if __name__ == "__main__":
    db_conn = setup_db()
    
    # Run the harvesters
    harvest_icsa(db_conn)
    harvest_yachtscoring(db_conn)
    
    db_conn.close()
    print("[+] Harvest cycle complete.")