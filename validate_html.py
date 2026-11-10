from html.parser import HTMLParser
import sys

class MyHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = []
        self.void_elements = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}

    def handle_starttag(self, tag, attrs):
        if tag not in self.void_elements:
            self.tags.append(tag)

    def handle_startendtag(self, tag, attrs):
        pass

    def handle_endtag(self, tag):
        if tag in self.void_elements:
             return
        if not self.tags:
            print(f"Error: Encountered closing tag </{tag}> but there are no open tags.")
            sys.exit(1)

        last_open_tag = self.tags.pop()
        if tag != last_open_tag:
            print(f"Error: Encountered closing tag </{tag}> but the last open tag was <{last_open_tag}>.")
            print(f"Current stack: {self.tags}")
            sys.exit(1)

parser = MyHTMLParser()
with open("index.html", "r", encoding="utf-8") as f:
    parser.feed(f.read())

if parser.tags:
    print(f"Error: Unclosed tags remaining: {parser.tags}")
    sys.exit(1)
else:
    print("HTML validation passed: All tags are properly closed.")
