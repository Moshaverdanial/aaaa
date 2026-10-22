#!/usr/bin/env python3
"""uitap.py ui.xml <class|text> → مختصات وسط اولین المانی که کلاس یا متنش پیدا شود (برای adb input tap)"""
import re, sys, xml.etree.ElementTree as ET
root = ET.parse(sys.argv[1]).getroot(); key = sys.argv[2]
for n in root.iter('node'):
    if key == n.get('class') or (n.get('text') and key in n.get('text')) or (n.get('content-desc') and key in n.get('content-desc')):
        m = re.findall(r'\d+', n.get('bounds'))
        x1, y1, x2, y2 = map(int, m)
        print((x1 + x2) // 2, (y1 + y2) // 2); sys.exit(0)
sys.exit(1)
