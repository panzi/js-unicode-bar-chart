export type Orientation = 'horizontal'|'vertical';
export type LabelPosition = 'before'|'after';

export interface BarChartOptions {
    yLabel?: boolean|((y: number) => string);
    xLabel?: boolean|((x: number) => string);
    yLabelMin?: boolean;
    yLabelMax?: boolean;
    yLabelPosition?: LabelPosition;
    xLabelPosition?: LabelPosition;
    width?:  number;
    height?: number;
    barWidth?: number;
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

export interface WrapColoredTextOptions {
    width?: number;
    textWidth?: (text: string) => number;
    textColor?: Color;
    backgroundColor?: Color;
    margin?: number;
    spacing?: number;
}

export function wrapColoredText(items: ReadonlyArray<readonly [text?: string|undefined, color?: Color]|string>, options?: WrapColoredTextOptions): string[] {
    const width = options?.width ?? 80;
    const textWidth = options?.textWidth ?? getTextWidth;
    const backgroundColor = options?.backgroundColor ?? 'black';
    const textColor = options?.textColor ?? (
        backgroundColor === 'white' ? 'black' :
        backgroundColor === 'default' ? 'default' :
        'white');
    const margin = options?.margin ?? 1;
    const spacing = options?.spacing ?? 2;
    const bg = COLOR_MAP[backgroundColor][1];
    const textFG = COLOR_MAP[textColor][0];

    let lineWidth = 0;
    let buf: string[] = [];
    const lineStart = `${bg}${textFG}${' '.repeat(margin)}`;
    const sep = `${textFG}${' '.repeat(spacing)}`;
    const lines: string[] = [];
    const remWidth = width - margin;

    for (const item of items) {
        let text: string|undefined;
        let color: Color|undefined;

        if (typeof item === 'string') {
            text = item;
        } else {
            [text, color] = item;
        }

        if (text) {
            const fg = color ? COLOR_MAP[color][0] : textFG;
            const itemWidth = textWidth(text);
            const nextLineWidth = lineWidth + (buf.length ? spacing : margin) + itemWidth;
            if (nextLineWidth <= remWidth) {
                buf.push(buf.length ? sep : lineStart, fg, text);
                lineWidth = nextLineWidth;
            } else {
                if (buf.length) {
                    buf.push(' '.repeat(Math.max(width - lineWidth, 0)), NORMAL);
                    lines.push(buf.join(''));
                    buf = [];
                }
                lineWidth = margin + itemWidth;
                if (lineWidth <= remWidth) {
                    buf.push(lineStart, fg, text);
                } else {
                    lineWidth = 0;
                    const spacePattern = /[ \t\r\n\v\u{2000}-\u{200B}\u{205F}\u{3000}]+/gu;
                    let prevIndex = 0;
                    while (prevIndex < text.length) {
                        const match = spacePattern.exec(text);
                        let space: string;
                        let spaceIndex: number;
                        let spaceWidth: number;

                        if (match) {
                            space = match[0];
                            spaceIndex = spacePattern.lastIndex - space.length;
                            spaceWidth = textWidth(space);
                        } else {
                            space = '';
                            spaceIndex = text.length;
                            spaceWidth = 0;
                        }

                        const word = text.slice(prevIndex, spaceIndex);
                        const wordWidth = textWidth(word);
                        let nextLineWidth = lineWidth + (buf.length ? 0 : margin) + wordWidth;

                        if (nextLineWidth <= remWidth || buf.length === 0) {
                            if (buf.length === 0) {
                                buf.push(lineStart, fg);
                            }
                            buf.push(word);
                            lineWidth = nextLineWidth;
                        } else {
                            if (buf.length) {
                                buf.push(' '.repeat(Math.max(width - lineWidth, 0)), NORMAL);
                                lines.push(buf.join(''));
                                buf = [];
                            }
                            buf.push(lineStart, fg, word);
                            lineWidth = margin + wordWidth;
                        }

                        nextLineWidth = lineWidth + spaceWidth;
                        if (nextLineWidth <= remWidth) {
                            buf.push(space);
                            lineWidth = nextLineWidth;
                        } else {
                            buf.push(' '.repeat(Math.max(width - lineWidth, 0)), NORMAL);
                            lines.push(buf.join(''));
                            buf = [];
                            lineWidth = 0;
                        }

                        prevIndex = spaceIndex + space.length;
                    }
                }
            }
        }
    }

    if (buf.length) {
        buf.push(' '.repeat(Math.max(width - lineWidth, 0)), NORMAL);
        lines.push(buf.join(''));
    }

    return lines;
}


export function unicodeBarChart(data: (Readonly<DataSeries>|NumberArray)[], options?: BarChartOptions): string[] {
    const datas: Readonly<ColoredDataSeries>[] = [];

    const backgroundColor = options?.backgroundColor ?? 'black';
    const textColor = options?.textColor ?? (
        backgroundColor === 'white' ? 'black' :
        backgroundColor === 'default' ? 'default' :
        'white');
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

    const orientation = options?.orientation ?? 'horizontal';
    const textWidth = options?.textWidth ?? getTextWidth;

    const bg = COLOR_MAP[backgroundColor][1];
    const bgInv = COLOR_MAP[backgroundColor][0];

    const footer: string[] = [];

    // TODO: add other stuff to footer

    footer.push(`${bg}${textFG}${' '.repeat(width)}${NORMAL}`);
    footer.push(...wrapColoredText(datas.map(item => [item.label, item.color]), {
        width,
        textWidth,
        textColor,
        backgroundColor,
    }));

    const chartWidth = width; // TODO: minus y-axis labels
    const chartHeight = height - footer.length; // TODO: minus x-axis labels

    const lines: string[] = [];

    if (xSize === 0 || chartWidth < (datas.length * xSize) || chartHeight <= 0) {
        const line = ' '.repeat(width);
        if (footer.length < height) {
            for (let y = 0; y < chartHeight; ++ y) {
                lines.push(line);
            }
            lines.push(...footer);
        } else {
            for (let y = 0; y < height; ++ y) {
                lines.push(line);
            }
        }
        return lines;
    }

    const xLabel = options?.xLabel === true ? String : options?.xLabel || null;
    const yLabel = options?.yLabel === true ? String : options?.yLabel || null;
    const xLabelPosition = options?.xLabelPosition ?? 'after';
    const yLabelPosition = options?.yLabelPosition ?? 'after';

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

    const intValues: Int32Array[] = [];

    if (orientation === 'horizontal') {
        const yLabels: [y: number, label: string, labelWidth: number][] = [];
        let chartWidth = width;
        let maxYLabelWidth = 0;

        if (yLabel) {
            const yLabelMin = options?.yLabelMin ?? true;
            const yLabelMax = options?.yLabelMax ?? true;
            const yValues = [yStart, yEnd, 0];

            if (yLabelMin) {
                yValues.push(yMin);
            }

            if (yLabelMax) {
                yValues.push(yMax);
            }

            for (const y of yValues) {
                const label = yLabel(y);
                const labelWidth = textWidth(label);
                if (labelWidth > maxYLabelWidth) {
                    maxYLabelWidth = labelWidth;
                }
                yLabels.push([y, label, labelWidth]);
            }

            chartWidth -= maxYLabelWidth + 1;
        }

        const barWidth = options?.barWidth ?? Math.max((chartWidth / (1 + ((datas.length + 1) * xSize)))|0, 1);
        const hSpaceWidth = Math.max(((chartWidth - (datas.length * barWidth * xSize)) / (xSize + 1))|0, 0);
        const hSpace = ' '.repeat(hSpaceWidth);
        const endSpace = ' '.repeat(Math.max(chartWidth - (xSize * (datas.length * barWidth + hSpaceWidth)), 0));
        const header: string[] = [];

        if (xLabel) {
            const xLabels: [label: string, labelWidth: number][] = [];
            let maxActualLabelWidth = 0;
            for (let x = 0; x < xSize; ++ x) {
                const label = xLabel(x);
                const labelWidth = textWidth(label);
                xLabels.push([label, labelWidth]);
                if (labelWidth > maxActualLabelWidth) {
                    maxActualLabelWidth = labelWidth;
                }
            }

            const maxLabelWidth = barWidth * datas.length + hSpaceWidth;
            let lineWidth = Math.ceil(hSpaceWidth / 2);
            const line: string[] = [bg, textFG, ' '.repeat(lineWidth)];
            const oldFooter = footer.splice(0, footer.length);
            const xLabelSection = xLabelPosition === 'before' ? header : footer;

            if (maxActualLabelWidth <= maxLabelWidth - 2) {
                for (const [label, labelWidth] of xLabels) {
                    const space = maxLabelWidth - labelWidth;
                    const lpad = space >> 1;
                    const rpad = space - lpad;
                    line.push(' '.repeat(lpad), label, ' '.repeat(rpad));
                    lineWidth += maxLabelWidth;
                }

                line.push(' '.repeat(width - lineWidth), NORMAL);
                xLabelSection.push(line.join(''));
            } else {
                for (let x = 0; x < xSize; ++ x) {
                    const footnote = String(x + 1);
                    const space = maxLabelWidth - textWidth(footnote);
                    const lpad = space >> 1;
                    const rpad = space - lpad;
                    line.push(' '.repeat(lpad), footnote, ' '.repeat(rpad));
                    lineWidth += maxLabelWidth;
                }

                xLabelSection.push(' '.repeat(width - lineWidth), NORMAL);
                footer.push(line.join(''));

                footer.push(`${bg}${textFG}${' '.repeat(width)}${NORMAL}`);
                footer.push(...wrapColoredText(xLabels.map(([label], index) => `[${index + 1}] ${label}`), {
                    width,
                    textWidth,
                    textColor,
                    backgroundColor,
                }));
            }

            footer.push(...oldFooter);
        }

        const chartHeight = height - footer.length - header.length;

        if (chartHeight <= 0 || chartWidth < (datas.length * xSize * barWidth + (xSize + 1) * hSpaceWidth)) {
            const line = ' '.repeat(width);
            if (footer.length < height) {
                for (let y = 0; y < chartHeight; ++ y) {
                    lines.push(line);
                }
                lines.push(...footer);
            } else {
                for (let y = 0; y < height; ++ y) {
                    lines.push(line);
                }
            }
            return lines;
        }

        lines.push(...header);

        const subCharHeight = chartHeight * 8;
        const intYZero = (subCharHeight * (yZero / ySize))|0;
        const yZeroIndex = chartHeight - ((intYZero / 8)|0) - 1;
        const clampedYZeroIndex = Math.min(Math.max(yZeroIndex, 0), chartHeight - 1);

        for (const item of datas) {
            const values = new Int32Array(xSize);

            for (let x = 0; x < xSize; ++ x) {
                const y = item.data.length > x ? item.data[x] : 0;
                const intY = subCharHeight * (y / ySize);
                values[x] = intY < 0 ? Math.floor(intY) : Math.ceil(intY);
            }

            intValues.push(values);
        }

        const yLabelMap: Map<number, string> = new Map();
        const labelFiller = ' '.repeat(1 + maxYLabelWidth);
        for (const [y, label, labelWidth] of yLabels) {
            const yIndex = y === yEnd ? 0 :
                y === yStart ? chartHeight - 1 :
                chartHeight - (((subCharHeight * (y / ySize)) / 8)|0) - ((intYZero / 8)|0) - 1;
            if (yIndex >= 0 && yIndex < chartHeight) {
                const pad = ' '.repeat(maxYLabelWidth - labelWidth);
                yLabelMap.set(yIndex, `${label}${pad}${NORMAL}`);
            }
        }

        const buf: string[][] = [];
        if (yLabelPosition === 'before') {
            for (let yIndex = 0; yIndex < chartHeight; ++ yIndex) {
                const label = yLabelMap.get(yIndex);
                if (label) {
                    buf.push([bg, textFG, label, ' ']);
                } else {
                    buf.push([bg, textFG, labelFiller]);
                }
            }
        } else {
            for (let y = 0; y < chartHeight; ++ y) {
                buf.push([bg, textFG]);
            }
        }

        const full = '█'.repeat(barWidth);
        const space = ' '.repeat(barWidth);
        for (let x = 0; x < xSize; ++ x) {
            for (let index = 0; index < datas.length; ++ index) {
                const item = datas[index];
                const values = intValues[index];
                const value = values[x];
                const { color } = item;
                const fg = COLOR_MAP[color][0];
                const thisHSpace = index === 0 ? hSpace : '';
                let yEndIndex = chartHeight - ((value / 8)|0) - ((intYZero / 8)|0);
                if (yEndIndex < 0) {
                    yEndIndex = 0;
                } else if (yEndIndex > chartHeight) {
                    yEndIndex = chartHeight;
                }

                let yIndex = 0;

                if (value >= 0) {
                    for (; yIndex < yEndIndex - 1; ++ yIndex) {
                        buf[yIndex].push(thisHSpace, space);
                    }

                    if (yIndex < chartHeight) {
                        const subSteps = value % 8;
                        if (subSteps > 0) {
                            buf[yIndex ++].push(thisHSpace, fg, VCHAR_MAP[subSteps].repeat(barWidth), textFG);
                        } else {
                            buf[yIndex ++].push(thisHSpace, space);
                        }

                        for (; yIndex <= clampedYZeroIndex; ++ yIndex) {
                            buf[yIndex].push(thisHSpace, fg, full, textFG);
                        }

                        for (; yIndex < chartHeight; ++ yIndex) {
                            buf[yIndex].push(thisHSpace, space);
                        }
                    }
                } else if (value < 0) {
                    for (; yIndex <= clampedYZeroIndex; ++ yIndex) {
                        buf[yIndex].push(thisHSpace, space);
                    }

                    for (; yIndex < yEndIndex; ++ yIndex) {
                        buf[yIndex].push(thisHSpace, fg, full, textFG);
                    }

                    if (yIndex < chartHeight) {
                        const subSteps = value % 8;
                        if (subSteps !== 0) {
                            const fgInv = COLOR_MAP[color][1];
                            buf[yIndex ++].push(thisHSpace, bgInv, fgInv, VCHAR_MAP[8 + subSteps].repeat(barWidth), textFG, bg);
                        }

                        for (; yIndex < chartHeight; ++ yIndex) {
                            buf[yIndex].push(thisHSpace, space);
                        }
                    }
                }
            }
        }

        if (yLabelPosition === 'after') {
            for (let yIndex = 0; yIndex < buf.length; ++ yIndex) {
                const line = buf[yIndex];
                const label = yLabelMap.get(yIndex);
                if (label) {
                    line.push(endSpace, ' ', label);
                } else {
                    line.push(endSpace, labelFiller, NORMAL);
                }
            }
        } else {
            for (const line of buf) {
                line.push(endSpace, NORMAL);
            }
        }

        for (const line of buf) {
            lines.push(line.join(''));
        }
    } else { // vertical
        let chartHeight = height - footer.length;

        // TODO: labels

        const barWidth = options?.barWidth ?? Math.max((chartHeight / (1 + ((datas.length + 1) * xSize)))|0, 1);
        const vSpaceWidth = Math.max(((chartHeight - (datas.length * barWidth * xSize)) / (xSize + 1))|0, 0);
        const endLines = Math.max(chartHeight - (xSize * (datas.length * barWidth + vSpaceWidth)), 0);

        // TODO: more labels

        const subCharWidth = chartWidth * 8;
        const intYZero = (subCharWidth * (yZero / ySize))|0;
        const yZeroIndex = chartWidth - ((intYZero / 8)|0) - 1;
        const clampedYZeroIndex = Math.min(Math.max(yZeroIndex, 0), chartWidth - 1);

        for (const item of datas) {
            const values = new Int32Array(xSize);

            for (let x = 0; x < xSize; ++ x) {
                const y = item.data.length > x ? item.data[x] : 0;
                const intY = subCharWidth * (y / ySize);
                values[x] = intY < 0 ? Math.floor(intY) : Math.ceil(intY);
            }

            intValues.push(values);
        }

        // TODO: more labels

        const emptyLine = `${bg}${textFG}${' '.repeat(chartWidth)}`;
        for (let x = 0; x < xSize; ++ x) {
            for (let index = 0; index < datas.length; ++ index) {
                const item = datas[index];
                const values = intValues[index];
                const value = values[x];
                const { color } = item;
                const fg = COLOR_MAP[color][0];
                let yEndIndex = chartWidth - ((value / 8)|0) - ((intYZero / 8)|0);
                if (yEndIndex < 0) {
                    yEndIndex = 0;
                } else if (yEndIndex > chartWidth) {
                    yEndIndex = chartWidth;
                }

                const line: string[] = [bg];

                let yIndex = 0;

                if (index === 0) {
                    for (let x = 0; x < vSpaceWidth; ++ x) {
                        lines.push(emptyLine);
                    }
                }

                // FIXME: this is inverted! and other bugs!
                if (value >= 0) {
                    if (yIndex < yEndIndex - 1) {
                        line.push(textFG, ' '.repeat((yEndIndex - 1) - yIndex));
                        yIndex = yEndIndex - 1;
                    }

                    if (yIndex < chartWidth) {
                        const subSteps = value % 8;
                        if (subSteps > 0) {
                            const fgInv = COLOR_MAP[color][1];
                            line.push(bgInv, fgInv, HCHAR_MAP[8 + subSteps], bg, fg);
                        } else {
                            line.push(' ', fg);
                        }
                        ++ yIndex;

                        if (yIndex <= clampedYZeroIndex) {
                            line.push('█'.repeat(clampedYZeroIndex - yIndex + 1));
                            yIndex = clampedYZeroIndex + 1;
                        }

                        line.push(textFG);

                        if (yIndex < chartWidth) {
                            line.push(' '.repeat(chartWidth - yIndex));
                            yIndex = chartWidth;
                        }
                    } else {
                        line.push(textFG);
                    }
                } else if (value < 0) {
                    if (yIndex <= clampedYZeroIndex) {
                        line.push(textFG, ' '.repeat(clampedYZeroIndex - yIndex + 1));
                        yIndex = clampedYZeroIndex + 1;
                    }

                    if (yIndex < yEndIndex) {
                        line.push(fg, '█'.repeat(yEndIndex - yIndex));
                        yIndex = yEndIndex;
                    } else {
                        line.push(fg);
                    }

                    if (yIndex < chartWidth) {
                        const subSteps = value % 8;
                        if (subSteps !== 0) {
                            line.push(HCHAR_MAP[subSteps]);
                            ++ yIndex;
                        }

                        line.push(textFG);

                        if (yIndex < chartWidth) {
                            line.push(' '.repeat(chartWidth - yIndex))
                            yIndex = chartWidth;
                        }
                    } else {
                        line.push(textFG);
                    }
                }

                const lineStr = line.join('');
                for (let x = 0; x < barWidth; ++ x) {
                    lines.push(lineStr);
                }
            }
        }

        // TODO
    }

    lines.push(...footer);

    return lines;
}

const ZERO_WIDTH_REGEX = /\x1B\[\d+(;\d+){0,4}m|[\u{E000}-\u{FFFF}\u{200B}-\u{200D}\u{2060}\u{FEFF}\p{Mn}]/gu;
// XXX: There are also half-width and full-width characters, emojis, flags etc. that all have different widths.

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
