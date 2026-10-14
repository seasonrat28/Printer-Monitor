import requests

ip = "10.119.34.203"
urls = [
    f"http://{ip}/PRESENTATION/HTML/TOP/INDEX.HTML",
    f"http://{ip}/PRESENTATION/ADVANCED/INFO_PRTINFO/TOP",
    f"http://{ip}/PRESENTATION/HTML/TOP/PRTINFO.HTML"
]

for url in urls:
    print(f"--- {url} ---")
    try:
        r = requests.get(url, verify=False, timeout=5)
        text = r.text
        if "EPSONFD99DA" in text:
            print("FOUND EPSONFD99DA!")
            # extract line
            for line in text.splitlines():
                if "EPSONFD99DA" in line:
                    print(line)
        else:
            print("Not found.")
    except Exception as e:
        print("Error:", e)
