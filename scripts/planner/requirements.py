"""Preserve calendar structure and classify course *uses*, not entire courses.

The roles aid planning. They are not a general-purpose graduation evaluator.
Unresolved clauses retain their source text and are never silently certified.
"""
import re
from bs4 import BeautifulSoup, NavigableString, Tag

CODE = re.compile(r'\b(?:[A-Z]{2,4}\d{3}|[A-Z]{3}[A-D]\d{2})[HY][0135]\b')
ADJACENT_CODES = re.compile(r'((?:[A-Z]{2,4}\d{3}|[A-Z]{3}[A-D]\d{2})[HY][0135])(?=(?:[A-Z]{2,4}\d{3}|[A-Z]{3}[A-D]\d{2})[HY][0135])')
RECOMMEND = re.compile(r'\b(recommend\w*|encourag\w*|urged|advisable|suggested)\b', re.I)
CHOICE = re.compile(r'\b(from|chosen|choose|selected|select|electives?|options?|one of|either)\b', re.I)
CREDIT_AMOUNT = re.compile(r'(\d+(?:\.\d+)?)\s*(?:additional\s+)?credits?\b', re.I)
CONDITION_ONLY = re.compile(
    r'^\s*(?:\d+[.)]\s*)?(?:-?only\b|no more than\b|at most\b|'
    r'students? (?:may|can) (?:use|count|take) (?:a )?maximum of\b|'
    r'the university of toronto requires\b|'
    r'this (?:program|stream) requires (?:the completion of )?a total\b|'
    r'sub[- ]?total\b)', re.I)
CATALOG_HEADING = re.compile(
    r'^(?:Group\s+(?:[A-Z]|[IVX]+|\d+)\b.*(?:[:]|\s-\s)|'
    r'Cluster\s+[A-Z]\s*[-:]|'
    r'Society-Culture Courses\b|Language Courses\b|'
    r'(?:Applied Genetics and Biotechnology|Global Health) Centric Courses\b|'
    r'Cognate courses\s*:)', re.I)


def elective_credit_minimum(text, role, kind):
    """Only attach a minimum to a completion elective, never a cap or total.

    The original calendar prose remains the authority for compound clauses.
    ``requiredCredits`` is deliberately absent when its first amount describes
    a program total, a substitution limit, or only one part of a range.
    """
    if role != 'elective' or kind != 'completion':
        return None
    amount = CREDIT_AMOUNT.search(text)
    if not amount:
        return None
    before = text[:amount.start()]
    after = text[amount.end():]
    if re.match(r'^\s*(?:\d+[.)]\s*)?of these\b', text, re.I):
        return None
    if re.match(r'^\s*(?:\d+[.)]\s*)?(?:remaining credits to total|following completion of .*?students are advised to)\b', text, re.I):
        return None
    if re.search(r'\bdistinct credits\b', before, re.I):
        return None
    if re.search(r'\b(?:up to|no more than|at most|(?:a )?maximum of|limited to|only)\s*$', before, re.I):
        return None
    if re.search(r'\b(?:to a total of|for a total of|program total to|sub[- ]?total\s*=\s*(?:\d+(?:\.\d+)?\s+or\s+)?|this (?:program|stream) requires (?:the completion of )?a total of)\s*$', before, re.I):
        return None
    if re.search(r'\b(?:program|stream)\s+requirements?\b', after[:100], re.I) and re.search(r'\b(?:total|to fulfill)\b', before[-60:], re.I):
        return None
    if re.match(r'\s*each\s*\(\s*total\b|\s*are required,\s*including\b', after, re.I):
        return None
    if re.match(r'^\s*\(?\d+(?:\.\d+)?\s*credits?\s*[,.;)]?\s*(?:including|please note)\b', text, re.I):
        return None
    if re.match(r'^\s*\d+(?:\.\d+)?\s*credits?\s+are required\.', text, re.I) and re.search(r'\bprogram\b', after, re.I):
        return None
    if re.search(r'\bthis (?:program|stream) requires (?:the completion of )?a total\b|\b(?:to be eligible for|to qualify for)\b', before, re.I):
        return None
    if re.match(r'\s*[,.;)]?\s*(?:including|in addition to)\b', after, re.I) and re.search(r'\b(?:must complete a total of|\d+(?:\.\d+)?\s+courses\s*\(|program total)\b', before, re.I):
        return None
    if re.search(r'\b\d+(?:\.\d+)?\s+to\s*$', before, re.I):
        return None
    if re.search(r'\b\d+(?:\.\d+)?\s+or\s*$', before, re.I):
        return None
    if re.search(r'\bfrom\s+(?:two|three|four|\d+)\s+(?:of\s+(?:the\s+)?\d+\s+)?(?:different\s+)?(?:areas|clusters)\b', after, re.I) and re.search(r'\btotal of\s+\d', after, re.I):
        return None
    return float(amount[1])


def expression_roles(text):
    """Classify only expressions made entirely of codes and explicit operators.

    Commas combine requirements; slash-separated expressions are alternatives.
    Ambiguous prose stays a reference instead of making every code optional.
    """
    text = re.sub(r'[\u200b\u200c\u200d\ufeff]', '', text)
    text = re.sub(r'^\d+[.)]\s+', '', text).strip().rstrip('.;')
    residue = CODE.sub('', text)
    if re.sub(r'\band\b|\bor\b|[\s,;/()\[\]]', '', residue, flags=re.I):
        return None
    if 'or' in text.lower() and ',' in text:
        return None
    text = text.replace('[', '(').replace(']', ')')
    text = re.sub(r'\band\b', ',', text, flags=re.I)
    text = re.sub(r'\bor\b', '/', text, flags=re.I)
    def parse(value, optional=False):
        value = value.strip()
        depth, splits = 0, []
        for i, char in enumerate(value):
            depth += (char == '(') - (char == ')')
            if depth < 0:
                return None
            if depth == 0 and char in ',;':
                splits.append(i)
        if depth:
            return None
        if splits:
            result, start = {}, 0
            for end in splits + [len(value)]:
                part = parse(value[start:end], optional)
                if part is None:
                    return None
                result.update(part)
                start = end + 1
            return result
        depth = 0
        for char in value:
            depth += (char == '(') - (char == ')')
            if char == '/' and depth == 0:
                return {c: 'alternative' for c in CODE.findall(value)}
        if value.startswith('(') and value.endswith(')'):
            return parse(value[1:-1], optional)
        return {value: 'alternative' if optional else 'required'} if CODE.fullmatch(value) else None
    return parse(text)


def lines(element):
    """Retain p/li/br/table/heading boundaries instead of flattening whole lists."""
    out, buffer = [], []
    depth = 0
    def flush():
        text = re.sub(r'\s+', ' ', ''.join(buffer)).strip()
        text = re.sub(r'\b([A-Z]{2,4})\s+(\d{3})\s*([HY])\s*([135])\b', r'\1\2\3\4', text)
        # Some calendar prose places two full course codes together with no
        # separator (EUR301H1EUR400H1). Keep both visible and discoverable.
        text = ADJACENT_CODES.sub(r'\1 ', text)
        buffer.clear()
        if text:
            out.append({'text': text, 'depth': depth})
    def visit(node):
        nonlocal depth
        if isinstance(node, NavigableString):
            buffer.append(str(node))
        elif isinstance(node, Tag):
            if node.name in ['script', 'style']:
                return
            boundary = node.name in ['p', 'li', 'ul', 'ol', 'div', 'br', 'tr', 'h2', 'h3', 'h4', 'h5']
            if boundary:
                flush()
            if node.name in ['ul', 'ol']:
                depth += 1
            for child in node.children:
                visit(child)
            if boundary:
                flush()
            if node.name in ['ul', 'ol']:
                depth -= 1
            if node.name in ['td', 'th']:
                buffer.append(' | ')
    visit(element)
    flush()
    return out


def blocks(element, kind='completion'):
    if not element:
        return []
    result, context, group = [], 'required', None
    for i, line in enumerate(lines(element)):
        text = line['text']
        codes = list(dict.fromkeys(CODE.findall(text)))
        numbered = bool(re.match(r'^\d+[.)]\s+(?!credits?\b)', text, re.I))
        year_heading = bool(re.match(r'^(?:\d+[.)]\s*)?(?:First|Second|Third|Fourth|Higher|Later|Early|[ABCD]-level)\b', text, re.I))
        numbered_credit_heading = not codes and bool(re.match(r'^\d+(?:\.\s+|\)\s*)\(?\d+(?:\.\d+)?\s*credits?\b', text, re.I))
        if year_heading or numbered_credit_heading or (numbered and context not in ('note', 'recommended')):
            context, group = 'required', None
        recommendation = bool(RECOMMEND.search(text))
        note = bool(re.match(r'^(?:\*?\s*Notes?\b|\*|For (?:more|further) information|Students (?:who|with)|Students in this program have the option to|If |Prerequisite)', text, re.I))
        amount = CREDIT_AMOUNT.search(text)
        # A combined degree's explanatory "study sequencing options" is not
        # an elective pool heading; otherwise keep existing pool context.
        choice = bool(CHOICE.search(CODE.sub('', text))) and (
            bool(amount) or bool(re.search(r'\b(one of|either|choose|electives|options)\b', text, re.I)))
        if re.search(r'\bstudy sequencing options\b', text, re.I):
            choice = False
        alternative = len(codes) > 1 and bool(re.search(r'\bor\b|/', text, re.I))
        heading = not codes and (text.endswith(':') or year_heading or choice)
        exclusion = bool(re.search(r'\b(?:may not be counted|cannot be counted|do not accept|not accepted|excluded from|cannot be used|not be used)\b', text, re.I))
        prose_alternative = len(codes) == 1 and bool(re.search(r'\bor\s+(?:an?\s+)?(?:approved\s+)?(?:equivalent|\d+(?:\.\d+)?\s+credits?|[A-Z][a-z]+\s+(?:Sciences?|Studies?))\b', text, re.I))
        group_catalog = not codes and bool(CATALOG_HEADING.match(text))
        mandatory_named = bool(codes) and bool(
            re.search(r'\bmust include\s*:', text, re.I)
            or re.match(r'^Students? must complete\s+all of the following\b', text, re.I)
            or (len(codes) == 1 and re.match(r'^Students? must complete\s+' + CODE.pattern, text, re.I)))
        conditional_course = bool(re.fullmatch(CODE.pattern + r'\s*\((?:not\s+)?required\)', text, re.I))
        sequencing_rule = bool(re.search(r'\bbefore taking any\b', text, re.I))
        mandatory_choice = len(codes) > 1 and bool(re.match(r'^Must complete one of\s+', text, re.I))
        required_before_pool = bool(re.match(
            r'^\d+(?:\.\d+)? credits? are required, including\s+', text, re.I)) and bool(
            re.search(r'\band\s+\d+(?:\.\d+)? additional credits? from\b', text, re.I))
        exempted = bool(codes) and bool(re.match(r'^Students? (?:are|is) exempted? from\b', text, re.I))
        if exclusion and codes:
            role = 'excluded'
        elif conditional_course or sequencing_rule:
            role = 'note'
        elif mandatory_choice or required_before_pool:
            role = 'reference'
            if required_before_pool:
                context, group = 'elective', f'{kind}-{i}'
        elif exempted:
            role = 'note'
        elif mandatory_named:
            role = 'required'
            context, group = 'required', None
        elif prose_alternative:
            role = 'reference'
        elif recommendation:
            timing = bool(re.search(r'\b(?:first|second|third|fourth)[ -]year\b', text, re.I))
            mixed = bool(re.search(r'\b(?:must|required)\b', text, re.I))
            role = 'reference' if mixed else 'recommended' if context == 'recommended' else 'note' if timing else 'recommended'
            # Do not let a parenthetical recommendation on one mandatory line
            # change every subsequent course's role.
            if re.match(r'^Writing Recommendation', text, re.I) or (not codes and context != 'elective'):
                context, group = role, f'{kind}-{i}'
        elif note:
            role = 'note'
            if not codes and text.endswith(':'):
                context, group = role, f'{kind}-{i}'
        elif not codes and re.fullmatch(r'Core Courses:?', text, re.I):
            role = 'note'
            context, group = 'reference', f'{kind}-{i}'
        elif group_catalog:
            role = 'note'
            context, group = 'elective', f'{kind}-{i}'
        elif CONDITION_ONLY.match(text):
            role = 'note'
            # Preserve the following list's scope. A cap can be interleaved
            # with an elective group, so relabelling this line must not make
            # later course lists inherit the note role.
            if choice:
                context = 'elective' if not codes else 'required'
                group = f'{kind}-{i}'
        elif choice:
            role = 'elective'
            # An inline pool already contains its choices. Its scope must not
            # leak into the following independent requirement (common in UTM).
            context = role if not codes else 'required'
            group = f'{kind}-{i}'
        elif context in ['recommended', 'note', 'elective', 'reference']:
            role = context
        elif alternative:
            role = 'alternative'
        elif codes and re.match(r'^(?:\d+[.)]\s*)?\(?\[?\s*' + re.escape(codes[0]), text):
            role = 'required'
        elif codes:
            role = 'reference'
        else:
            role = 'note'
        if kind == 'enrolment':
            role = 'admission'
        block = {**line, 'codes': codes, 'role': role, 'manualReview': True,
                 'heading': heading, 'groupId': group or f'{kind}-{i}'}
        if mandatory_named and kind != 'enrolment':
            block['codeRoles'] = {c: 'required' for c in codes}
        elif mandatory_choice and kind != 'enrolment':
            block['codeRoles'] = {c: 'alternative' for c in codes}
        elif required_before_pool and kind != 'enrolment':
            prefix = re.split(r'\band\s+\d+(?:\.\d+)? additional credits? from\b', text, maxsplit=1, flags=re.I)[0]
            block['codeRoles'] = {c: 'required' for c in CODE.findall(prefix)}
        elif role in ['required', 'alternative'] and kind != 'enrolment':
            per_code = expression_roles(text)
            if per_code:
                block['codeRoles'] = per_code
                if len(set(per_code.values())) > 1:
                    block['role'] = 'reference'
            elif role == 'alternative' and re.search(r'\band\b|,', text, re.I):
                block['role'] = 'reference'
            elif role == 'required' and len(codes) > 1:
                block['role'] = 'reference'
        block['excludedCodes'] = codes if role == 'excluded' else [c for c in codes if re.search(re.escape(c) + r'\s+(?:cannot|may not|must not|does not|is not|will not|can not)\b', text, re.I)]
        if choice and not mandatory_named:
            credit_minimum = elective_credit_minimum(text, block['role'], kind)
            if credit_minimum is not None:
                block['requiredCredits'] = credit_minimum
        result.append(block)
    # Drupal sometimes puts a standalone "or" between two list entries.
    # It connects both neighbouring choices; neither is independently required.
    for i, block in enumerate(result):
        if re.fullmatch(r'or[.:]?', block['text'], re.I) and 0 < i < len(result) - 1:
            for neighbour in (result[i - 1], result[i + 1]):
                if neighbour['codes'] and neighbour['role'] in ('required', 'alternative', 'reference'):
                    neighbour['role'] = 'alternative'
                    neighbour['codeRoles'] = {c: 'alternative' for c in neighbour['codes']}
    return result
