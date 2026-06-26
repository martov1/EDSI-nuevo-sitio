from pathlib import Path
import re

root = Path(r'c:\EDSI nuevo sitio')
html_files = list(root.glob('*.html')) + list(root.glob('empresas/*.html')) + list(root.glob('Particulares/**/*.html'))
exclude = {root / 'header.html', root / 'footer.html'}

for file in html_files:
    if file in exclude:
        continue
    text = file.read_text(encoding='utf-8')
    title_match = re.search(r'<title>(.*?)</title>', text, re.S|re.I)
    title = title_match.group(1).strip() if title_match else file.stem.replace('-', ' ').title()

    body_match = re.search(r'<body[^>]*>(.*)</body>', text, re.S|re.I)
    if not body_match:
        print(f'SKIP no body: {file}')
        continue
    body = body_match.group(1)

    # remove header/footer placeholders and base tags
    body = re.sub(r'<div id="header"></div>\s*', '', body, flags=re.I)
    body = re.sub(r'<div id="footer"></div>\s*', '', body, flags=re.I)
    body = re.sub(r'<base[^>]*>\s*', '', body, flags=re.I)
    # Remove any head-level includes accidentally present in body
    body = re.sub(r'<link[^>]*href="(?:\.\/)?style\.css"[^>]*>\s*', '', body, flags=re.I)
    body = re.sub(r'<script[^>]*src="(?:\.\/)?script\.js"[^>]*>\s*</script>\s*', '', body, flags=re.I)

    # normalize paths
    body = re.sub(r'href="/([^\"]*)"', r'href="{{ site.baseurl }}/\1"', body)
    body = re.sub(r'src="/([^\"]*)"', r'src="{{ site.baseurl }}/\1"', body)
    body = re.sub(r'href="assets/([^\"]*)"', r'href="{{ site.baseurl }}/assets/\1"', body)
    body = re.sub(r'src="assets/([^\"]*)"', r'src="{{ site.baseurl }}/assets/\1"', body)
    body = re.sub(r'img src="assets/([^\"]*)"', r'img src="{{ site.baseurl }}/assets/\1"', body)
    body = re.sub(r'href="\.\/([Cc]apacitacion-[^\"]*)"', r'href="{{ site.baseurl }}/\1"', body)
    body = re.sub(r'href="\.\/([^\"]*)"', r'href="{{ site.baseurl }}/\1"', body)

    body = body.strip() + '\n'

    css_path = None
    css_candidate = file.with_suffix('.css')
    if css_candidate.exists():
        css_path = '/' + '/'.join(css_candidate.relative_to(root).parts)

    front_matter = ['---', 'layout: default', f'title: {title}']
    if css_path:
        front_matter.append(f'css: {css_path}')
    front_matter.append('---\n')

    new_text = '\n'.join(front_matter) + body
    file.write_text(new_text, encoding='utf-8')
    print(f'Converted {file}')
