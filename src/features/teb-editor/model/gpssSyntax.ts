/**
 * Lightweight GPSS World syntax support for the model text editor: highlighting tokens, the names
 * table ("Показать таблицу имён") and "Перейти к определению".
 */

export type TokenKind = 'label' | 'block' | 'command' | 'definition' | 'auxiliary' | 'number' | 'sna' | 'string' | 'name' | 'operator' | 'comment' | 'text';

export interface Token {
  kind: TokenKind;
  text: string;
}

const BLOCKS = new Set(
  (
    'GENERATE TERMINATE ADVANCE SEIZE RELEASE PREEMPT RETURN FAVAIL FUNAVAIL QUEUE DEPART ENTER LEAVE SAVAIL SUNAVAIL TRANSFER TEST GATE ' +
    'LOGIC SAVEVALUE MSAVEVALUE ASSIGN MARK PRIORITY SPLIT ASSEMBLE GATHER MATCH LOOP BUFFER TABULATE LINK UNLINK ADOPT INDEX COUNT SELECT ' +
    'DISPLACE JOIN REMOVE EXAMINE SCAN ALTER PLUS EXECUTE TRACE UNTRACE OPEN CLOSE READ WRITE SEEK INTEGRATION'
  ).split(' '),
);

const DEFINITIONS = new Set('STORAGE TABLE QTABLE VARIABLE FVARIABLE BVARIABLE FUNCTION EQU MATRIX'.split(' '));

const COMMANDS = new Set('INITIAL START RESET CLEAR SIMULATE END RMULT SHOW HALT CONTINUE STEP INCLUDE INTEGRATE CONDUCT REPORT STOP EXIT'.split(' '));

const AUXILIARY = new Set('L LE E NE G GE U NU I NI SE SNE SF SNF SV SNV FV FNV LS LR S R MIN MAX'.split(' '));

const SNA_FAMILIES = new Set(
  'Q QA QM QC QZ QT QX F FC FR FT FI FV S R SR SM SC SA ST SE SF SV X P FN V BV N W LS LR TB TC TD CH CA CM CC CT RN MX GN GT MB MP'.split(' '),
);

const ATOMIC_SNAS = new Set('AC1 C1 M1 MP XN1 PR TG1 A1 Z1'.split(' '));

export function isOperation(word: string): boolean {
  const upper = word.toUpperCase();
  return BLOCKS.has(upper) || DEFINITIONS.has(upper) || COMMANDS.has(upper);
}

function operationKind(word: string): TokenKind {
  const upper = word.toUpperCase();
  return BLOCKS.has(upper) ? 'block' : DEFINITIONS.has(upper) ? 'definition' : 'command';
}

/** Splits code from the ";" comment (semicolons inside strings do not count). */
function splitComment(line: string): [string, string] {
  let inString = false;
  for (let index = 0; index < line.length; index++) {
    if (line[index] === '"') {
      inString = !inString;
    } else if (line[index] === ';' && !inString) {
      return [line.slice(0, index), line.slice(index)];
    }
  }

  return [line, ''];
}

const OPERAND_PATTERN =
  /("[^"]*"?)|('[A-Za-z]+')|(\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|\.\d+)|([A-Za-zА-Яа-яЁё_][\wА-Яа-яЁё]*(?:\$[\wА-Яа-яЁё]+|\*[\wА-Яа-яЁё$]+)?)|(\s+)|([^\s"'\wА-Яа-яЁё]+)/gu;

function operandTokens(text: string): Token[] {
  const tokens: Token[] = [];
  for (const match of text.matchAll(OPERAND_PATTERN)) {
    const [whole, quoted, relation, number, word, space] = match;
    if (quoted) {
      tokens.push({ kind: 'string', text: whole });
    } else if (relation) {
      tokens.push({ kind: 'operator', text: whole });
    } else if (number) {
      tokens.push({ kind: 'number', text: whole });
    } else if (word) {
      tokens.push({ kind: isSna(word) ? 'sna' : 'name', text: whole });
    } else if (space) {
      tokens.push({ kind: 'text', text: whole });
    } else {
      tokens.push({ kind: 'operator', text: whole });
    }
  }

  return tokens;
}

function isSna(word: string): boolean {
  const separator = word.search(/[$*]/);
  if (separator > 0) {
    return SNA_FAMILIES.has(word.slice(0, separator).toUpperCase());
  }

  const upper = word.toUpperCase();
  const numbered = /^([A-Z]+)(\d+)$/.exec(upper);
  return ATOMIC_SNAS.has(upper) || (numbered !== null && SNA_FAMILIES.has(numbered[1]));
}

/** Tokens of one line, concatenating back to the line exactly. */
export function tokenizeLine(line: string): Token[] {
  if (/^\s*\*/.test(line)) {
    return [{ kind: 'comment', text: line }];
  }

  const [code, comment] = splitComment(line);
  const tokens: Token[] = [];
  const parts = code.match(/\s+|[^\s]+/g) ?? [];
  let words = 0;
  let operationSeen = false;
  let auxiliaryAllowed = false;

  for (const part of parts) {
    if (/^\s+$/.test(part)) {
      tokens.push({ kind: 'text', text: part });
      continue;
    }

    words++;
    if (!operationSeen && isOperation(part)) {
      tokens.push({ kind: operationKind(part), text: part });
      operationSeen = true;
      auxiliaryAllowed = ['TEST', 'GATE', 'LOGIC', 'COUNT', 'SELECT', 'REMOVE', 'SCAN', 'ALTER'].includes(part.toUpperCase());
    } else if (!operationSeen && words === 1) {
      tokens.push({ kind: 'label', text: part });
    } else if (auxiliaryAllowed && AUXILIARY.has(part.toUpperCase())) {
      tokens.push({ kind: 'auxiliary', text: part });
      auxiliaryAllowed = false;
    } else {
      auxiliaryAllowed = false;
      tokens.push(...operandTokens(part));
    }
  }

  if (comment) {
    tokens.push({ kind: 'comment', text: comment });
  }

  return tokens;
}

export type NameKind = 'Метка' | 'Память' | 'Таблица' | 'Переменная' | 'Функция' | 'Константа' | 'Матрица' | 'Объект';

export interface NameEntry {
  name: string;
  kind: NameKind;
  /** 1-based line of the definition (or of the first use for entities without a definition). */
  line: number;
  /** Number of lines that mention the name. */
  uses: number;
}

const DEFINITION_KINDS: Record<string, NameKind> = {
  STORAGE: 'Память',
  TABLE: 'Таблица',
  QTABLE: 'Таблица',
  VARIABLE: 'Переменная',
  FVARIABLE: 'Переменная',
  BVARIABLE: 'Переменная',
  FUNCTION: 'Функция',
  EQU: 'Константа',
  MATRIX: 'Матрица',
};

/** Names defined in the model (labels and definition statements) and other entity names used in operands. */
export function collectNames(text: string): NameEntry[] {
  const entries = new Map<string, NameEntry>();
  const lines = text.split('\n');

  lines.forEach((line, index) => {
    const tokens = tokenizeLine(line);
    const label = tokens.find((token) => token.kind === 'label');
    const operation = tokens.find((token) => token.kind === 'block' || token.kind === 'definition' || token.kind === 'command');
    if (label && operation) {
      const key = label.text.toUpperCase();
      const kind = DEFINITION_KINDS[operation.text.toUpperCase()] ?? 'Метка';
      if (!entries.has(key) || entries.get(key)?.kind === 'Объект') {
        entries.set(key, { name: label.text, kind, line: index + 1, uses: entries.get(key)?.uses ?? 0 });
      }
    }
  });

  lines.forEach((line, index) => {
    const seen = new Set<string>();
    for (const token of tokenizeLine(line)) {
      if (token.kind !== 'name' && token.kind !== 'sna') {
        continue;
      }

      const name = token.kind === 'sna' ? token.text.split(/[$*]/)[1] : token.text;
      if (!name || /^\d/.test(name)) {
        continue;
      }

      const key = name.toUpperCase();
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      const entry = entries.get(key);
      if (entry) {
        entry.uses++;
      } else if (token.kind === 'sna' || token.kind === 'name') {
        entries.set(key, { name, kind: 'Объект', line: index + 1, uses: 1 });
      }
    }
  });

  return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

/** Line of the definition of `name` (label or definition statement), or null. */
export function findDefinition(text: string, name: string): number | null {
  const entry = collectNames(text).find((item) => item.name.toUpperCase() === name.toUpperCase());
  return entry && entry.kind !== 'Объект' ? entry.line : null;
}

/** Word (name or SNA argument) at the given character offset. */
export function wordAt(text: string, offset: number): string | null {
  const isWordChar = (char: string | undefined) => char !== undefined && /[\wА-Яа-яЁё]/u.test(char);
  let start = offset;
  while (start > 0 && isWordChar(text[start - 1])) {
    start--;
  }

  let end = offset;
  while (end < text.length && isWordChar(text[end])) {
    end++;
  }

  return end > start ? text.slice(start, end) : null;
}

/** Character offsets of the start and end of a 1-based line. */
export function lineRange(text: string, line: number): [number, number] {
  const lines = text.split('\n');
  const start = lines.slice(0, Math.max(0, line - 1)).reduce((sum, item) => sum + item.length + 1, 0);
  return [start, start + (lines[line - 1]?.length ?? 0)];
}
