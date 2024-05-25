export type Orientation = 'horizontal'|'vertical';

export interface BarChartOptions {
    yLabel?: boolean|((y: number) => string);
    width?:  number;
    height?: number;
    yRange?: [min: number, max: number];
    orientation?: Orientation;
    textColor?: Color;
    backgroundColor?: Color;
    textWidth?: (text: string) => number;
}

export type NumberArray = number[]|Float64Array|Float32Array|Int8Array|Int16Array|Int32Array;

export interface DataSeries {
    label?: string;
    color?: Color;
    data: NumberArray;
}

interface ColoredDataSeries extends DataSeries {
    color: Color;
}

export function isNumberArray(value: unknown): value is NumberArray {
    return Array.isArray(value) ||
        value instanceof Float64Array ||
        value instanceof Float32Array ||
        value instanceof Int8Array ||
        value instanceof Int16Array ||
        value instanceof Int32Array;
}

export function unicodeBarChart(data: (Readonly<DataSeries>|NumberArray)[], options?: BarChartOptions): string[] {
    const datas: Readonly<ColoredDataSeries>[] = [];

    const backgroundColor = options?.backgroundColor ?? 'black';
    const textColor = options?.textColor ?? (backgroundColor === 'white' ? 'black' : 'white');
    const textFG = COLOR_MAP[textColor][0];
    const defaultColors = DEFAULT_COLOR_SEQUENCE.slice();
    const colorIndex = defaultColors.findIndex(color => color === backgroundColor);
    defaultColors.splice(colorIndex, 1);

    let xSize = 0;
    let yMin = Infinity;
    let yMax = -Infinity;
    for (let index = 0; index < data.length; ++ index) {
        const item = data[index];
        let newItem: Readonly<ColoredDataSeries>;
        if (isNumberArray(item)) {
            newItem = {
                data: item,
                color: index === 0 ?
                    defaultColors[0] :
                    defaultColors[(defaultColors.indexOf(datas[index - 1].color) + 1) % defaultColors.length]
            };
        } else {
            newItem = item.color ? item as ColoredDataSeries : {
                ...item,
                color: index === 0 ?
                    defaultColors[0] :
                    defaultColors[(defaultColors.indexOf(datas[index - 1].color) + 1) % defaultColors.length]
            };
        }

        const len = newItem.data.length;
        if (len > xSize) {
            xSize = len;
        }

        for (const y of newItem.data) {
            if (y > yMax) {
                yMax = y;
            }

            if (y < yMin) {
                yMin = y;
            }
        }

        datas.push(newItem);
    }

    const width  = options?.width  ?? 80;
    const height = options?.height ?? 40;

    let lines: string[];
    if (xSize === 0 || width <= 0 || height <= 0) {
        lines = [];
        const line = ' '.repeat(width);
        for (let y = 0; y < height; ++ y) {
            lines.push(line);
        }
        return lines;
    }

    const subCharHeight = height * 8;

    // TODO: y-axis labels
    const yLabel = options?.yLabel === true ? String : options?.yLabel || null;

    const orientation = options?.orientation ?? 'horizontal';
    const textWidth = options?.textWidth ?? getTextWidth;
    const yRange = options?.yRange;

    let yStart: number;
    let yEnd: number;

    if (yRange) {
        [yStart, yEnd] = yRange;
    } else {
        yStart = yMin > 0 ? 0 : yMin;
        yEnd   = yMax < 0 ? 0 : yMax;
    }

    const ySize = yEnd - yStart;
    const yZero = -yStart;

    const bg = COLOR_MAP[backgroundColor][1];
    const bgInv = COLOR_MAP[backgroundColor][0];
    const intValues: Int32Array[] = [];

    if (orientation === 'horizontal') {
        const intYZero = (subCharHeight * (yZero / ySize))|0;
        const yZeroIndex = height - ((intYZero / 8)|0) - 1;
        const clampedYZeroIndex = Math.min(Math.max(yZeroIndex, 0), height - 1);

        for (const item of datas) {
            const values = new Int32Array(xSize);

            for (let x = 0; x < xSize; ++ x) {
                const y = item.data.length > x ? item.data[x] : 0;
                const intY = subCharHeight * (y / ySize);
                values[x] = intY < 0 ? Math.floor(intY) : Math.ceil(intY);
            }

            intValues.push(values);
        }

        const hSpaceWidth = Math.max(((width - (datas.length * xSize)) / (xSize + 1))|0, 0);
        const hSpace = ' '.repeat(hSpaceWidth);
        const buf: string[][] = [];
        const endSpace = ' '.repeat(Math.max(width - (xSize * (datas.length + hSpaceWidth)), 0));

        for (let y = 0; y < height; ++ y) {
            buf.push([bg, textFG]);
        }

        for (let x = 0; x < xSize; ++ x) {
            for (let index = 0; index < datas.length; ++ index) {
                const item = datas[index];
                const values = intValues[index];
                const value = values[x];
                const fg = COLOR_MAP[item.color][0];
                const thisHSpace = index === 0 ? hSpace : '';
                let yEndIndex = height - ((value / 8)|0) - ((intYZero / 8)|0);
                if (yEndIndex < 0) {
                    yEndIndex = 0;
                } else if (yEndIndex > height) {
                    yEndIndex = height;
                }

                let yIndex = 0;

                if (value >= 0) {
                    for (; yIndex < yEndIndex - 1; ++ yIndex) {
                        buf[yIndex].push(thisHSpace, ' ');
                    }

                    if (yIndex < height) {
                        const subSteps = value % 8;
                        if (subSteps > 0) {
                            buf[yIndex ++].push(thisHSpace, fg, VCHAR_MAP[subSteps], textFG);
                        } else {
                            buf[yIndex ++].push(thisHSpace, ' ');
                        }

                        for (; yIndex <= clampedYZeroIndex; ++ yIndex) {
                            buf[yIndex].push(thisHSpace, fg, '█', textFG);
                        }

                        for (; yIndex < height; ++ yIndex) {
                            buf[yIndex].push(thisHSpace, ' ');
                        }
                    }
                } else if (value < 0) {
                    const fgInv = COLOR_MAP[item.color][1];
                    for (; yIndex <= clampedYZeroIndex; ++ yIndex) {
                        buf[yIndex].push(thisHSpace, ' ');
                    }

                    for (; yIndex < yEndIndex; ++ yIndex) {
                        buf[yIndex].push(thisHSpace, fg, '█', textFG);
                    }

                    if (yIndex < height) {
                        const subSteps = value % 8;
                        if (subSteps !== 0) {
                            buf[yIndex ++].push(thisHSpace, bgInv, fgInv, VCHAR_MAP[8 + subSteps], textFG, bg);
                        }

                        for (; yIndex < height; ++ yIndex) {
                            buf[yIndex].push(thisHSpace, ' ');
                        }
                    }
                }
            }
        }

        for (const line of buf) {
            line.push(endSpace, NORMAL);
        }

        lines = buf.map(line => line.join(''));
    } else { // vertical
        throw new Error('not implemented');
    }

    lines.push(`${bg}${textFG}${' '.repeat(width)}${NORMAL}`);
    let lineWidth = 0;
    let buf: string[] = [];
    const lineStart = `${bg}${textFG} `;
    const sep = `${textFG}  `;
    for (const item of datas) {
        let label = item.label;
        if (label) {
            const fg = COLOR_MAP[item.color][0];
            const labelWidth = textWidth(label);
            const nextLineWidth = lineWidth + (buf.length ? 2 : 1) + labelWidth;
            if (nextLineWidth <= width) {
                buf.push(buf.length ? sep : lineStart, fg, label);
                lineWidth = nextLineWidth;
            } else {
                if (buf.length) {
                    buf.push(' '.repeat(Math.max(width - lineWidth, 0)), NORMAL);
                    lines.push(buf.join(''));
                    buf = [];
                }
                buf.push(lineStart, fg, label);
                lineWidth = labelWidth + 1;
            }
        }
    }

    if (buf.length > 0) {
        buf.push(' '.repeat(Math.max(width - lineWidth, 0)), NORMAL);
        lines.push(buf.join(''));
    }

    //if (1==1)process.exit(1)

    return lines;
}

const ZERO_WIDTH_REGEX = /\x1B\[\d+(;\d+){0,4}m|[\u{E000}-\u{FFFF}\u{200B}-\u{200D}\u{2060}\u{FEFF}\p{Mn}]/gu;
// XXX: there are also half-width and full-width characters, emojis, flags etc. that all have differnt lengths

/** HACK: Slow and not very accurat. */
export function getTextWidth(text: string): number {
    return text.replace(ZERO_WIDTH_REGEX, '').length;
}

const VCHAR_MAP = [
    '▁', // 1/8 0.125
    '▂', // 1/4 0.25
    '▃', // 3/8 0.375
    '▄', // 1/2 0.5
    '▅', // 5/8 0.625
    '▆', // 3/4 0.75
    '▇', // 7/8 0.875
    '█', // 1/1 1
];

const HCHAR_MAP = [
    '▏', // 1/8 0.125
    '▎', // 1/4 0.25
    '▍', // 3/8 0.375
    '▌', // 1/2 0.5
    '▋', // 5/8 0.625
    '▊', // 3/4 0.75
    '▉', // 7/8 0.875
    '█', // 1/1 1
];

export type Color =
    'black'|'red'|'green'|'yellow'|'blue'|'magenta'|'cyan'|'white'|'gray'|
    'bright_red'|'bright_green'|'bright_yellow'|'bright_blue'|'bright_magenta'|
    'bright_cyan'|'bright_white'|'default';

const COLOR_MAP: { [color in Color]: [fg: string, bg: string] } = {
    black:          ['\x1B[30m', '\x1B[40m'],
    red:            ['\x1B[31m', '\x1B[41m'],
    green:          ['\x1B[32m', '\x1B[42m'],
    yellow:         ['\x1B[33m', '\x1B[43m'],
    blue:           ['\x1B[34m', '\x1B[44m'],
    magenta:        ['\x1B[35m', '\x1B[45m'],
    cyan:           ['\x1B[36m', '\x1B[46m'],
    white:          ['\x1B[37m', '\x1B[47m'],
    gray:           ['\x1B[90m', '\x1B[100m'],
    bright_red:     ['\x1B[91m', '\x1B[101m'],
    bright_green:   ['\x1B[92m', '\x1B[102m'],
    bright_yellow:  ['\x1B[93m', '\x1B[103m'],
    bright_blue:    ['\x1B[94m', '\x1B[104m'],
    bright_magenta: ['\x1B[95m', '\x1B[105m'],
    bright_cyan:    ['\x1B[96m', '\x1B[106m'],
    bright_white:   ['\x1B[97m', '\x1B[107m'],
    default:        ['\x1B[39m', '\x1B[49m'],
};

const NORMAL = '\x1B[0m';
const BOLD = '\x1B[1m';

const DEFAULT_COLOR_SEQUENCE: Color[] = [
    'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white', 'black',
];
