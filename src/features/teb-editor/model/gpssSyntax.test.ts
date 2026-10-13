import { collectNames, findDefinition, lineRange, tokenizeLine, wordAt } from './gpssSyntax';

const MODEL = [
  'Cash STORAGE 2',
  'Rate FUNCTION RN1,C2',
  '0,0/1,10',
  ' GENERATE 5',
  'Back TEST L Q$Line,S$Cash,Away ;wait',
  ' TRANSFER ,Back',
  'Away TERMINATE 1',
].join('\n');

describe('GPSS syntax', () => {
  it('tokenizes labels, operations, auxiliary operators, SNAs and comments losslessly', () => {
    const tokens = tokenizeLine('Back TEST L Q$Line,S$Cash,Away ;wait');

    expect(tokens.map((token) => token.text).join('')).toBe('Back TEST L Q$Line,S$Cash,Away ;wait');
    expect(tokens.filter((token) => token.kind !== 'text').map((token) => [token.kind, token.text])).toEqual([
      ['label', 'Back'],
      ['block', 'TEST'],
      ['auxiliary', 'L'],
      ['sna', 'Q$Line'],
      ['operator', ','],
      ['sna', 'S$Cash'],
      ['operator', ','],
      ['name', 'Away'],
      ['comment', ';wait'],
    ]);
    expect(tokenizeLine('* comment line')).toEqual([{ kind: 'comment', text: '* comment line' }]);
    expect(tokenizeLine(' START 10').find((token) => token.kind === 'command')?.text).toBe('START');
    expect(tokenizeLine(' ADVANCE (Exponential(1,0,X$Mean)) ').some((token) => token.kind === 'sna' && token.text === 'X$Mean')).toBe(true);
  });

  it('builds the names table with definitions and uses', () => {
    const names = collectNames(MODEL);

    expect(names.find((entry) => entry.name === 'Cash')).toMatchObject({ kind: 'Память', line: 1, uses: 1 });
    expect(names.find((entry) => entry.name === 'Back')).toMatchObject({ kind: 'Метка', line: 5, uses: 1 });
    expect(names.find((entry) => entry.name === 'Line')).toMatchObject({ kind: 'Объект', line: 5 });
    expect(names.find((entry) => entry.name === 'Rate')?.kind).toBe('Функция');
  });

  it('finds definitions and the word under the caret', () => {
    expect(findDefinition(MODEL, 'away')).toBe(7);
    expect(findDefinition(MODEL, 'Line')).toBeNull();
    expect(wordAt(MODEL, MODEL.indexOf(',Away') + 3)).toBe('Away');
    expect(lineRange(MODEL, 2)).toEqual([15, 35]);
  });
});
