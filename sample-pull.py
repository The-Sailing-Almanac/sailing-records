import httpx
from bs4 import BeautifulSoup
import pandas as pd
import time

def scrape_universal_test():
    # Using 16828 (Bacardi Cup) because we know it's massive and full of boats
    test_eids = [16828, 16752]
    pilot_data = []
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0"}

    print("[-] Starting Universal Table Parser...")

    with httpx.Client(follow_redirects=True, timeout=15.0, headers=headers) as client:
        for eid in test_eids:
            url = f"https://yachtscoring.com/current_entry_list.cfm?eID={eid}"
            print(f"[-] Pulling RAW HTML from eID {eid}...")
            
            try:
                resp = client.get(url)
                soup = BeautifulSoup(resp.text, 'html.parser')
                
                # We are going to grab EVERY row in EVERY table on the page
                all_rows = soup.find_all('tr')
                print(f"    [.] Found {len(all_rows)} total rows on page. Filtering for data...")

                for row in all_rows:
                    cols = row.find_all('td')
                    # If the row has data, let's just grab it all
                    if len(cols) >= 2:
                        cells = [c.text.strip() for c in cols if c.text.strip()]
                        
                        # We only want rows that actually have content
                        if len(cells) > 2:
                            pilot_data.append({
                                'eID': eid,
                                'Content': " | ".join(cells),
                                'Col_Count': len(cells)
                            })
                
                time.sleep(1)

            except Exception as e:
                print(f"    [!] Request Error: {e}")

    return pilot_data

if __name__ == "__main__":
    results = scrape_universal_test()
    if results:
        df = pd.DataFrame(results)
        df.to_csv('UNIVERSAL_RAW_TEST.csv', index=False)
        print(f"\n[!] FILE CREATED: 'UNIVERSAL_RAW_TEST.csv'")
        print(f"[!] Total Data Rows Captured: {len(df)}")
        print("\n[!] Top 5 rows captured:")
        print(df['Content'].head(5))
    else:
        print("\n[!] Still getting 0. This suggests the site might be blocking the script's 'User-Agent'.")