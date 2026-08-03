import { diagnosticError } from "./diagnostics.js";
import { looksLikeNaturalSurface, parseNaturalSurface } from "./natural-parser.js";
const identifierPattern = /[\p{ID_Start}_$]/u;
const identifierPartPattern = /[\p{ID_Continue}$\u200C\u200D]/u;
const keywordAliases = {
    category: ["category", "категория"],
    structure: ["structure", "структура"],
    functor: ["functor", "функтор"],
    proposition: ["proposition", "утверждение"],
};
const propositionKindAliases = {
    witness: ["witness", "свидетельство"],
    apply: ["apply", "применить"],
    compose: ["compose", "композиция"],
};
const propositionPropertyAliases = {
    selector: "selector",
    селектор: "selector",
    value: "value",
    значение: "value",
    path: "path",
    путь: "path",
    detail: "detail",
    описание: "detail",
    functor: "functor",
    функтор: "functor",
    functors: "functors",
    функторы: "functors",
    arg: "arg",
    аргумент: "arg",
};
export function compile(source) {
    if (typeof source !== "string") {
        throw diagnosticError("FTS_SOURCE_TYPE", "source must be a string");
    }
    const text = source.trim();
    if (text.length === 0) {
        throw diagnosticError("FTS_EMPTY_SOURCE", "empty source");
    }
    if (text.startsWith("{") || text.startsWith("[") || /\bexport\s+default\b/.test(text)) {
        return compileJsonLike(text);
    }
    if (looksLikeNaturalSurface(source))
        return parseNaturalSurface(source);
    return new Parser(source).parseDocument();
}
function compileJsonLike(source) {
    let body = source;
    const match = source.match(/\bexport\s+default\s+([\s\S]+?)\s*;?\s*$/);
    if (match?.[1] !== undefined)
        body = match[1].trim();
    body = body.replace(/\s+as\s+const\s*;?\s*$/i, "").replace(/;+\s*$/, "");
    try {
        return normalizeDocument(JSON.parse(body));
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw diagnosticError("FTS_INVALID_JSON", `invalid JSON document: ${message}`);
    }
}
export function normalizeDocument(input) {
    if (!isRecord(input)) {
        throw diagnosticError("FTS_DOCUMENT_TYPE", "document must be an object");
    }
    const utilities = Array.isArray(input.utilities) ? input.utilities : undefined;
    return {
        category: typeof input.category === "string" ? input.category : "",
        structures: Array.isArray(input.structures) ? input.structures : [],
        functors: Array.isArray(input.functors) ? input.functors : [],
        proposition: isRecord(input.proposition) ? input.proposition : null,
        ts_compat: isRecord(input.ts_compat) ? input.ts_compat : {},
        ...(utilities !== undefined ? { utilities } : {}),
    };
}
class Parser {
    #tokens;
    #index = 0;
    constructor(source) {
        this.#tokens = tokenize(source);
    }
    parseDocument() {
        this.#skipNewlines();
        this.#expectKeyword("category");
        const category = this.#expectName("expected category name").value;
        this.#expectValue("{");
        const structures = [];
        const functors = [];
        let proposition = null;
        while (!this.#at("}") && !this.#atKind("eof")) {
            this.#skipSeparators();
            if (this.#at("}"))
                break;
            if (this.#atKeyword("structure")) {
                structures.push(this.#parseStructure());
            }
            else if (this.#atKeyword("functor")) {
                functors.push(this.#parseFunctor());
            }
            else if (this.#atKeyword("proposition")) {
                if (proposition !== null)
                    this.#fail("FTS_MULTIPLE_PROPOSITIONS", "a category may contain only one proposition");
                proposition = this.#parseProposition(true);
            }
            else {
                this.#fail("FTS_UNEXPECTED_TOKEN", `unexpected token '${this.#peek().value}' in category`);
            }
        }
        this.#expectValue("}");
        this.#skipSeparators();
        if (!this.#atKind("eof"))
            this.#fail("FTS_TRAILING_INPUT", "unexpected content after category");
        return { category, structures, functors, proposition, ts_compat: {} };
    }
    #parseStructure() {
        this.#expectKeyword("structure");
        const name = this.#expectName("expected structure name").value;
        this.#expectValue("{");
        const fields = [];
        while (!this.#at("}") && !this.#atKind("eof")) {
            this.#skipSeparators();
            if (this.#at("}"))
                break;
            const field = this.#expectName("expected field name").value;
            const optional = this.#consume("?");
            this.#expectValue(":");
            const typeParts = [];
            let genericDepth = 0;
            while (!this.#atKind("eof")) {
                const token = this.#peek();
                if (token.value === "<")
                    genericDepth += 1;
                if (token.value === ">")
                    genericDepth -= 1;
                if (genericDepth <= 0 && (token.kind === "newline" || token.value === ";" || token.value === "}"))
                    break;
                typeParts.push(this.#advance().value);
            }
            if (typeParts.length === 0)
                this.#fail("FTS_FIELD_TYPE", `field '${field}' requires a type`);
            const type = formatType(typeParts) + (optional ? " | undefined" : "");
            fields.push({ name: field, type });
            this.#skipSeparators();
        }
        this.#expectValue("}");
        const ts_compat = renderTsCompat(name, fields);
        return { name, fields, ts_compat };
    }
    #parseFunctor() {
        this.#expectKeyword("functor");
        const name = this.#expectName("expected functor name").value;
        this.#expectValue(":");
        const domain = this.#readTypeUntil("->");
        this.#expectKind("arrow", "expected '->' in functor declaration");
        const codomain = this.#readTypeToLineEnd();
        if (domain.length === 0 || codomain.length === 0) {
            this.#fail("FTS_FUNCTOR_SIGNATURE", `functor '${name}' requires a domain and codomain`);
        }
        this.#skipSeparators();
        return { name, domain, codomain, law: "functor.arrow" };
    }
    #parseProposition(prefixed) {
        if (prefixed)
            this.#expectKeyword("proposition");
        const kindToken = this.#expectIdentifier("expected proposition kind");
        const kind = canonicalPropositionKind(kindToken.value);
        switch (kind) {
            case "witness":
                return this.#parseWitness();
            case "apply":
                return this.#parseApply();
            case "compose":
                return this.#parseCompose();
            default:
                this.#fail("FTS_PROPOSITION_KIND", `unknown proposition kind '${kindToken.value}'`, kindToken);
        }
    }
    #parseWitness() {
        const structure = this.#expectName("witness requires Structure.field").value;
        this.#expectValue(".");
        const field = this.#expectName("witness requires Structure.field").value;
        const body = this.#parsePropositionBody();
        const proposition = { kind: "witness", structure, field };
        if (isRecord(body.selector))
            proposition.selector = body.selector;
        if (body.value !== undefined)
            proposition.value = body.value;
        if (Array.isArray(body.path))
            proposition.path = body.path;
        if (typeof body.detail === "string")
            proposition.detail = body.detail;
        return proposition;
    }
    #parseApply() {
        let inlineFunctor;
        if (isNameToken(this.#peek()) && this.#peek(1).value === "{") {
            inlineFunctor = this.#expectName("apply proposition requires a functor").value;
        }
        const body = this.#parsePropositionBody();
        const functor = inlineFunctor ?? (typeof body.functor === "string" ? body.functor : undefined);
        if (functor === undefined)
            this.#fail("FTS_APPLY_FUNCTOR", "apply proposition requires a functor");
        if (!isProposition(body.arg))
            this.#fail("FTS_APPLY_ARG", "apply proposition requires a nested proposition");
        const proposition = { kind: "apply", functor, arg: body.arg };
        if (typeof body.detail === "string")
            proposition.detail = body.detail;
        return proposition;
    }
    #parseCompose() {
        let inlineFunctors;
        if (this.#at("["))
            inlineFunctors = this.#parseValue();
        const body = this.#parsePropositionBody();
        const functors = inlineFunctors ?? (Array.isArray(body.functors) ? body.functors.map((value) => String(value).normalize("NFC")) : undefined);
        if (functors === undefined || functors.length === 0) {
            this.#fail("FTS_COMPOSE_FUNCTORS", "compose proposition requires one or more functors");
        }
        if (!isProposition(body.arg))
            this.#fail("FTS_COMPOSE_ARG", "compose proposition requires a nested proposition");
        const proposition = { kind: "compose", functors, arg: body.arg };
        if (typeof body.detail === "string")
            proposition.detail = body.detail;
        return proposition;
    }
    #parsePropositionBody() {
        this.#expectValue("{");
        const body = {};
        while (!this.#at("}") && !this.#atKind("eof")) {
            this.#skipSeparators();
            if (this.#at("}"))
                break;
            if (this.#atKeyword("proposition")) {
                body.arg = this.#parseProposition(true);
                continue;
            }
            if (this.#atPropositionKind()) {
                body.arg = this.#parseProposition(false);
                continue;
            }
            const rawKey = this.#expectName("expected proposition property").value;
            const key = propositionPropertyAliases[rawKey] ?? rawKey;
            this.#consume(":");
            body[key] = this.#parseValue();
            this.#skipSeparators();
        }
        this.#expectValue("}");
        return body;
    }
    #parseValue() {
        const token = this.#peek();
        if (token.kind === "string") {
            this.#advance();
            return token.value;
        }
        if (token.kind === "number") {
            this.#advance();
            return Number(token.value);
        }
        if (token.kind === "identifier") {
            this.#advance();
            if (token.value === "true")
                return true;
            if (token.value === "false")
                return false;
            if (token.value === "null")
                return null;
            return token.value;
        }
        if (token.value === "[") {
            this.#advance();
            const result = [];
            while (!this.#at("]") && !this.#atKind("eof")) {
                this.#skipSeparators();
                if (this.#at("]"))
                    break;
                result.push(this.#parseValue());
                this.#consume(",");
            }
            this.#expectValue("]");
            return result;
        }
        if (token.value === "{") {
            this.#advance();
            const result = {};
            while (!this.#at("}") && !this.#atKind("eof")) {
                this.#skipSeparators();
                if (this.#at("}"))
                    break;
                const keyToken = this.#peek();
                if (keyToken.kind !== "identifier" && keyToken.kind !== "string") {
                    this.#fail("FTS_OBJECT_KEY", "expected object key");
                }
                const key = this.#advance().value;
                this.#expectValue(":");
                result[key] = this.#parseValue();
                this.#consume(",");
            }
            this.#expectValue("}");
            return result;
        }
        this.#fail("FTS_VALUE", `expected value, got '${token.value}'`);
    }
    #readTypeUntil(value) {
        const parts = [];
        while (!this.#at(value) && !this.#atKind("newline") && !this.#atKind("eof")) {
            parts.push(this.#advance().value);
        }
        return formatType(parts);
    }
    #readTypeToLineEnd() {
        const parts = [];
        while (!this.#atKind("newline") && !this.#atKind("eof") && !this.#at(";") && !this.#at("}")) {
            parts.push(this.#advance().value);
        }
        return formatType(parts);
    }
    #skipSeparators() {
        while (this.#atKind("newline") || this.#at(";") || this.#at(","))
            this.#advance();
    }
    #skipNewlines() {
        while (this.#atKind("newline"))
            this.#advance();
    }
    #expectKeyword(keyword) {
        if (!this.#atKeyword(keyword))
            this.#fail("FTS_EXPECTED_KEYWORD", `expected '${keyword}'`);
        return this.#advance();
    }
    #expectIdentifier(message) {
        return this.#expectKind("identifier", message);
    }
    #expectName(message) {
        const token = this.#peek();
        if (!isNameToken(token))
            this.#fail("FTS_UNEXPECTED_TOKEN", message, token);
        this.#advance();
        return { ...token, value: token.value.normalize("NFC") };
    }
    #expectKind(kind, message) {
        const token = this.#peek();
        if (token.kind !== kind)
            this.#fail("FTS_UNEXPECTED_TOKEN", message, token);
        return this.#advance();
    }
    #expectValue(value) {
        const token = this.#peek();
        if (token.value !== value)
            this.#fail("FTS_UNEXPECTED_TOKEN", `expected '${value}', got '${token.value}'`, token);
        return this.#advance();
    }
    #consume(value) {
        if (!this.#at(value))
            return false;
        this.#advance();
        return true;
    }
    #at(value) {
        return this.#peek().value === value;
    }
    #atKind(kind) {
        return this.#peek().kind === kind;
    }
    #atKeyword(value) {
        const token = this.#peek();
        return token.kind === "identifier" && keywordAliases[value].includes(token.value);
    }
    #atPropositionKind() {
        const token = this.#peek();
        return token.kind === "identifier" && canonicalPropositionKind(token.value) !== undefined;
    }
    #peek(ahead = 0) {
        return this.#tokens[Math.min(this.#index + ahead, this.#tokens.length - 1)];
    }
    #advance() {
        const token = this.#peek();
        if (this.#index < this.#tokens.length - 1)
            this.#index += 1;
        return token;
    }
    #fail(code, message, token = this.#peek()) {
        throw diagnosticError(code, message, { span: token.span });
    }
}
function tokenize(source) {
    const tokens = [];
    let offset = 0;
    let line = 1;
    let column = 1;
    const position = () => ({ offset, line, column });
    const advance = () => {
        const character = source[offset] ?? "";
        offset += 1;
        if (character === "\n") {
            line += 1;
            column = 1;
        }
        else {
            column += 1;
        }
        return character;
    };
    const push = (kind, value, start) => {
        tokens.push({ kind, value, span: { start, end: position() } });
    };
    while (offset < source.length) {
        const character = source[offset];
        if (character === " " || character === "\t" || character === "\r") {
            advance();
            continue;
        }
        if (character === "\n") {
            const start = position();
            advance();
            push("newline", "\n", start);
            continue;
        }
        if (character === "/" && source[offset + 1] === "/") {
            while (offset < source.length && source[offset] !== "\n")
                advance();
            continue;
        }
        if (character === "/" && source[offset + 1] === "*") {
            const start = position();
            advance();
            advance();
            while (offset < source.length && !(source[offset] === "*" && source[offset + 1] === "/"))
                advance();
            if (offset >= source.length)
                throw diagnosticError("FTS_UNCLOSED_COMMENT", "unclosed block comment", { span: { start, end: position() } });
            advance();
            advance();
            continue;
        }
        if ((character === "-" && source[offset + 1] === ">") || (character === "=" && source[offset + 1] === ">")) {
            const start = position();
            advance();
            advance();
            push("arrow", "->", start);
            continue;
        }
        if (character === '"' || character === "'" || character === "«") {
            const start = position();
            const quote = advance();
            const closingQuote = quote === "«" ? "»" : quote;
            let raw = "";
            let closed = false;
            while (offset < source.length) {
                const next = advance();
                if (next === closingQuote) {
                    closed = true;
                    break;
                }
                if (next === "\\") {
                    const escaped = advance();
                    const escapes = { n: "\n", r: "\r", t: "\t", '"': '"', "'": "'", "\\": "\\" };
                    if (escaped === "u") {
                        const hexadecimal = source.slice(offset, offset + 4);
                        if (!/^[0-9A-Fa-f]{4}$/.test(hexadecimal)) {
                            throw diagnosticError("FTS_STRING_ESCAPE", "invalid Unicode escape", { span: { start, end: position() } });
                        }
                        for (let count = 0; count < 4; count += 1)
                            advance();
                        raw += String.fromCharCode(Number.parseInt(hexadecimal, 16));
                    }
                    else {
                        raw += escapes[escaped] ?? escaped;
                    }
                }
                else {
                    raw += next;
                }
            }
            if (!closed)
                throw diagnosticError("FTS_UNCLOSED_STRING", "unclosed string literal", { span: { start, end: position() } });
            push("string", raw, start);
            continue;
        }
        if (/\d/.test(character) || (character === "-" && /\d/.test(source[offset + 1] ?? ""))) {
            const start = position();
            const match = source.slice(offset).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
            const value = match?.[0];
            if (value === undefined)
                throw diagnosticError("FTS_NUMBER", "invalid number", { span: { start, end: position() } });
            for (let count = 0; count < value.length; count += 1)
                advance();
            push("number", value, start);
            continue;
        }
        if (identifierPattern.test(character)) {
            const start = position();
            let value = advance();
            while (identifierPartPattern.test(source[offset] ?? ""))
                value += advance();
            push("identifier", value.normalize("NFC"), start);
            continue;
        }
        const start = position();
        push("punctuation", advance(), start);
    }
    const end = position();
    tokens.push({ kind: "eof", value: "<eof>", span: { start: end, end } });
    return tokens;
}
function formatType(parts) {
    return parts
        .join(" ")
        .replace(/\s+([>,.\[\]])/g, "$1")
        .replace(/([<.\[])\s+/g, "$1")
        .replace(/\s*\|\s*/g, " | ")
        .replace(/\s*&\s*/g, " & ")
        .trim()
        .normalize("NFC");
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isProposition(value) {
    return isRecord(value) && ["witness", "apply", "compose"].includes(String(value.kind));
}
function canonicalPropositionKind(value) {
    return Object.entries(propositionKindAliases).find(([, aliases]) => aliases.includes(value))?.[0];
}
function isNameToken(token) {
    return token.kind === "identifier" || token.kind === "string";
}
function typescriptAlias(name) {
    if (/^[\p{ID_Start}_$][\p{ID_Continue}$\u200C\u200D]*$/u.test(name))
        return name;
    return `FTS_${Array.from(name, (character) => character.codePointAt(0).toString(16)).join("_")}`;
}
function renderTsCompat(name, fields) {
    const identifier = /^[\p{ID_Start}_$][\p{ID_Continue}$\u200C\u200D]*$/u;
    if (identifier.test(name) && fields.every((field) => identifier.test(field.name))) {
        return `interface ${name} { ${fields.map((field) => `${field.name}: ${field.type}`).join("; ")} }`;
    }
    return `type ${typescriptAlias(name)} = { ${fields.map((field) => `${JSON.stringify(field.name)}: ${typescriptType(field.type)}`).join("; ")} }`;
}
function typescriptType(type) {
    const parts = type.split(/\s*\|\s*/u);
    const valid = parts.every((part) => ["string", "number", "boolean", "unknown", "undefined", "null"].includes(part) ||
        /^[\p{ID_Start}_$][\p{ID_Continue}$\u200C\u200D]*$/u.test(part));
    return valid ? parts.join(" | ") : `unknown /* FTS: ${type.replace(/\*\//g, "* /")} */`;
}
