export type Orientation = 'horizontal'|'vertical';
export type LabelPosition = 'before'|'after';

export interface BarChartOptions {
    /** Default: `false` */
    yLabel?: boolean|((y: number) => string);

    /** Default: `false` */
    xLabel?: boolean|((x: number) => string);

    /** Show minimum Y-value in Y-axis labels.
     * 
     * Default: `true`
     */
    yLabelMin?: boolean;

    /** Show maximum Y-value in Y-axis labels.
     * 
     * Default: `true`
     */
    yLabelMax?: boolean;

    /** Default: `'after'` if {@link orientation} is '`horizontal'`, `'before'` otherwise. */
    yLabelPosition?: LabelPosition;

    /** Default: `'after'` if {@link orientation} is '`horizontal'`, `'before'` otherwise. */
    xLabelPosition?: LabelPosition;

    /** Default: 80 */
    width?: number;

    /** Default: 40 */
    height?: number;

    /** Tries to fill the given space per default. */
    barWidth?: number;

    /** From minimum to maximum Y-value per default. */
    yRange?: [min: number, max: number];

    /** Default: `'horizontal'` */
    orientation?: Orientation;

    /** Default: `'black'` */
    backgroundColor?: Color;

    /** Default: `'black'` if {@link backgroundColor} is `'white'`,
     * `'default'` if {@link backgroundColor} is `'default'`, and `'white'` otherwise.
     */
    textColor?: Color;

    /** A function to measure the width of a text as it will be displayed on the terminal.
     * 
     * This function shall ignore simple ANSI escapes, diacritics and other zero width
     * Unicode code points, and shall at least handle all latin characters. It may assume
     * that no newline occures in the text. You may want to pass in a function that uses
     * a propper Unicode library to measure text width. The default function uses some
     * very limited and hacky regular expressions.
     * 
     * Default: {@link getTextWidth}
     * 
     * @param text The text to measure.
     * @returns The number of terminal characters the text is wide.
     */
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

function alignInternal(text: string, textWidth: number, width: number, align: 'left'|'right'|'center'): string {
    const rem = Math.max(width - textWidth, 0);
    if (align === 'center') {
        const rpad = rem >> 1;
        const lpad = rem - rpad;
        return `${' '.repeat(lpad)}${text}${' '.repeat(rpad)}`;
    } else if (align === 'left') {
        return text + ' '.repeat(rem);
    } else {
        return ' '.repeat(rem) + text;
    }
}

function getMaxWordWidth(text: string, textWidth: (text: string) => number): number {
    let maxWidth = 0;
    for (const word of text.split(/[ \t\r\n\v\u{2000}-\u{200B}\u{205F}\u{3000}]+|\n/gu)) {
        const width = textWidth(word);
        if (width > maxWidth) {
            maxWidth = width;
        }
    }
    return maxWidth;
}

export function wrapText(text: string, width: number, align: 'left'|'right'|'center'='left', margin: number=0, textWidth?: (text: string) => number): { lines: string[], maxWidth: number } {
    textWidth ??= getTextWidth;
    const lines: string[] = [];
    const marginSpace = ' '.repeat(margin);
    let maxWidth = width;

    let line: string[] = [marginSpace];
    let lineWidth = margin;
    const spacePattern = /[ \t\r\n\v\u{2000}-\u{200B}\u{205F}\u{3000}]+|\n/gu;
    let prevIndex = 0;
    let prevSpaceWidth = 0;
    while (prevIndex < text.length) {
        const match = spacePattern.exec(text);
        let space: string;
        let spaceIndex: number;
        let spaceWidth: number;

        if (match) {
            space = match[0];
            spaceIndex = spacePattern.lastIndex - space.length;
            spaceWidth = space === '\n' ? 0 : textWidth(space);
            //space = '_'.repeat(spaceWidth);
        } else {
            space = '';
            spaceIndex = text.length;
            spaceWidth = 0;
        }

        const word = text.slice(prevIndex, spaceIndex);
        const wordWidth = textWidth(word);
        let nextLineWidth = lineWidth + wordWidth;

        if (nextLineWidth <= width - margin || lineWidth <= margin) {
            line.push(word);
            lineWidth = nextLineWidth;
        } else {
            if (lineWidth > margin) {
                if (prevSpaceWidth > 0) {
                    lineWidth -= prevSpaceWidth;
                    line.pop();
                }
                line.push(marginSpace);
                lineWidth += margin;
                lines.push(alignInternal(line.join(''), lineWidth, width, align));
                line = [marginSpace];
                if (lineWidth > maxWidth) {
                    maxWidth = lineWidth;
                }
            }
            line.push(word);
            lineWidth = margin + wordWidth;
        }

        nextLineWidth = lineWidth + spaceWidth;
        if (nextLineWidth < width - margin && space !== '\n') {
            line.push(space);
            lineWidth = nextLineWidth;
            prevSpaceWidth = spaceWidth;
        } else {
            line.push(marginSpace);
            lineWidth += margin;
            lines.push(alignInternal(line.join(''), lineWidth, width, align));
            if (lineWidth > maxWidth) {
                maxWidth = lineWidth;
            }
            line = [marginSpace];
            lineWidth = margin;
            prevSpaceWidth = 0;
        }

        prevIndex = spaceIndex + space.length;
    }

    if (lineWidth > margin) {
        line.push(marginSpace);
        lineWidth += margin;
        lines.push(alignInternal(line.join(''), lineWidth, width, align));
        if (lineWidth > maxWidth) {
            maxWidth = lineWidth;
        }
    }

    return { lines, maxWidth };
}

/**
 * Plot a bar chart for terminal display using Unicode characters and ANSI escape esquences.
 * 
 * @param data 
 * @param options 
 * @returns The plotted bar chart
 */
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

    footer.push(`${bg}${textFG}${' '.repeat(width)}${NORMAL}`);
    footer.push(...wrapColoredText(datas.map(item => [item.label, item.color]), {
        width,
        textWidth,
        textColor,
        backgroundColor,
    }));

    const chartWidth = width;
    const chartHeight = height - footer.length;

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
        const xLabelPosition = options?.xLabelPosition ?? 'after';
        const yLabelPosition = options?.yLabelPosition ?? 'after';
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
            const maxLabelWidth = barWidth * datas.length + hSpaceWidth;
            const xLabels: [label: string, wrapped: string[]][] = [];
            let maxActualLabelWidth = 0;
            let maxLabelLines = 0;
            for (let x = 0; x < xSize; ++ x) {
                const label = xLabel(x);
                const { maxWidth, lines } = wrapText(label, maxLabelWidth, 'center', 1, textWidth);
                xLabels.push([label, lines]);
                if (maxWidth > maxActualLabelWidth) {
                    maxActualLabelWidth = maxWidth;
                }
                const lineCount = lines.length;
                if (lineCount > maxLabelLines) {
                    maxLabelLines = lineCount;
                }
            }

            const oldFooter = footer.splice(0, footer.length);
            const xLabelSection = xLabelPosition === 'before' ? header : footer;
            const lpadWidth = Math.ceil(hSpaceWidth / 2) + (yLabelPosition === 'before' ? maxYLabelWidth + 1 : 0);
            const lpad = ' '.repeat(lpadWidth);

            if (maxActualLabelWidth <= maxLabelWidth) {
                const emptyLabel = ' '.repeat(maxLabelWidth);
                const rpad = ' '.repeat(width - maxLabelWidth * xSize - lpadWidth);
                for (let index = 0; index < maxLabelLines; ++ index) {
                    const line: string[] = [bg, textFG, lpad];
                    for (const [_label, wrapped] of xLabels) {
                        const label = index < wrapped.length ?
                            wrapped[index] :
                            emptyLabel;
                        line.push(label);
                    }
                    line.push(rpad, NORMAL);
                    xLabelSection.push(line.join(''));
                }
            } else {
                const line: string[] = [bg, textFG, lpad];
                let lineWidth = lpadWidth;

                for (let x = 0; x < xSize; ++ x) {
                    const footnote = String(x + 1);
                    const space = maxLabelWidth - textWidth(footnote);
                    const lpad = space >> 1;
                    const rpad = space - lpad;
                    line.push(' '.repeat(lpad), footnote, ' '.repeat(rpad));
                    lineWidth += maxLabelWidth;
                }

                line.push(' '.repeat(width - lineWidth), NORMAL);
                xLabelSection.push(line.join(''));

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
                yLabelMap.set(yIndex, `${label}${pad}`);
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
                        if (yIndex === yEndIndex - 1) {
                            const subSteps = value % 8;
                            if (subSteps !== 0) {
                                buf[yIndex ++].push(thisHSpace, fg, VCHAR_MAP[subSteps].repeat(barWidth), textFG);
                            } else {
                                buf[yIndex ++].push(thisHSpace, space);
                            }
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
                    line.push(endSpace, ' ', label, NORMAL);
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
        const xLabelPosition = options?.xLabelPosition ?? 'before';
        const yLabelPosition = options?.yLabelPosition ?? 'before';

        let chartHeight = height - footer.length - (yLabel ? 1 : 0);
        let chartWidth = width;

        let barWidth = options?.barWidth ?? Math.max((chartHeight / (1 + ((datas.length + 1) * xSize)))|0, 1);
        let vSpaceWidth = Math.max(((chartHeight - (datas.length * barWidth * xSize)) / (xSize + 1))|0, 0);
        const prefix: string[] = [];
        const suffix: string[] = [];

        let prefixWidth = 0;
        if (xLabel) {
            let maxActualLabelWidth = 0;
            let maxLabelLines = 0;
            const labels: string[] = [];
            let maxWordWidth = 0;
            let maxSingleLineLabelWidth = 0;
            for (let x = 0; x < xSize; ++ x) {
                const label = xLabel(x);
                const thisMaxWordWidth = getMaxWordWidth(label, textWidth);
                if (thisMaxWordWidth > maxWordWidth) {
                    maxWordWidth = thisMaxWordWidth;
                }
                const labelWidth = textWidth(label);
                if (labelWidth > maxSingleLineLabelWidth) {
                    maxSingleLineLabelWidth = labelWidth;
                }
                labels.push(label);
            }
            const maxLabelWidth = Math.min(Math.max(maxWordWidth, Math.min(16, maxSingleLineLabelWidth)), width >> 1);
            const align = xLabelPosition === 'before' ? 'right' : 'left';
            const xLabels: [label: string, wrapped: string[]][] = [];
            for (const label of labels) {
                const { maxWidth, lines } = wrapText(label, maxLabelWidth, align, 0, textWidth);
                xLabels.push([label, lines]);
                if (maxWidth > maxActualLabelWidth) {
                    maxActualLabelWidth = maxWidth;
                }
                const lineCount = lines.length;
                if (lineCount > maxLabelLines) {
                    maxLabelLines = lineCount;
                }
            }

            const xLabelSection = xLabelPosition === 'before' ? prefix : suffix;

            const vLabelSpace = datas.length * barWidth + Math.max(vSpaceWidth - 2, 0);
            if (maxLabelLines <= vLabelSpace && maxActualLabelWidth <= maxLabelWidth) {
                const fullVLabelSpace = datas.length * barWidth + vSpaceWidth;
                const linesBefore = vSpaceWidth >> 1;
                const emptyLine = ' '.repeat(maxLabelWidth);
                while (xLabelSection.length < linesBefore) {
                    xLabelSection.push(emptyLine);
                }

                for (const [_, labelLines] of xLabels) {
                    const rem = fullVLabelSpace - labelLines.length;
                    const after = rem >> 1;
                    const before = rem - after;
                    for (let y = 0; y < before; ++ y) {
                        xLabelSection.push(emptyLine);
                    }
                    for (const line of labelLines) {
                        xLabelSection.push(line);
                    }
                    for (let y = 0; y < after; ++ y) {
                        xLabelSection.push(emptyLine);
                    }
                }

                while (xLabelSection.length < chartHeight) {
                    xLabelSection.push(emptyLine);
                }

                chartWidth -= maxLabelWidth;
                if (xLabelPosition === 'before') {
                    prefixWidth = maxLabelWidth;
                }
            } else {
                footer.push(`${bg}${textFG}${' '.repeat(width)}${NORMAL}`);
                footer.push(...wrapColoredText(xLabels.map(([label], index) => `[${index + 1}] ${label}`), {
                    width,
                    textWidth,
                    textColor,
                    backgroundColor,
                }));

                // chart height changed, so we need to recalculate some stuff
                chartHeight = height - footer.length - (yLabel ? 1 : 0);

                barWidth = options?.barWidth ?? Math.max((chartHeight / (1 + ((datas.length + 1) * xSize)))|0, 1);
                vSpaceWidth = Math.max(((chartHeight - (datas.length * barWidth * xSize)) / (xSize + 1))|0, 0);

                const fullVLabelSpace = datas.length * barWidth + vSpaceWidth;
                const linesBefore = vSpaceWidth >> 1;

                const shortLabels: [label: string, labelWidth: number][] = [];
                for (let x = 0; x < xSize; ++ x) {
                    const label = String(x + 1);
                    const labelWidth = textWidth(label);
                    shortLabels.push([label, labelWidth]);
                }
                const maxLabelWidth = xSize > 0 ? shortLabels[xSize - 1][1] : 0;
                const emptyLine = ' '.repeat(maxLabelWidth);
                while (xLabelSection.length < linesBefore) {
                    xLabelSection.push(emptyLine);
                }

                for (const [label, labelWidth] of shortLabels) {
                    const rem = fullVLabelSpace - 1;
                    const after = rem >> 1;
                    const before = rem - after;
                    for (let y = 0; y < before; ++ y) {
                        xLabelSection.push(emptyLine);
                    }
                    xLabelSection.push(alignInternal(label, labelWidth, maxLabelWidth, align));
                    for (let y = 0; y < after; ++ y) {
                        xLabelSection.push(emptyLine);
                    }
                }

                while (xLabelSection.length < chartHeight) {
                    xLabelSection.push(emptyLine);
                }

                chartWidth -= maxLabelWidth;
                if (xLabelPosition === 'before') {
                    prefixWidth = maxLabelWidth;
                }
            }
        }

        while (prefix.length < chartHeight) {
            prefix.push('');
        }

        while (suffix.length < chartHeight) {
            suffix.push('');
        }

        const subCharWidth = chartWidth * 8;
        const intYZero = (subCharWidth * (yZero / ySize))|0;
        const yZeroIndex = chartWidth - ((intYZero / 8)|0) - 1;
        const clampedYZeroIndex = Math.min(Math.max(yZeroIndex, 0), chartWidth - 1);

        if (yLabel) {
            const yLabelMin = options?.yLabelMin ?? true;
            const yLabelMax = options?.yLabelMax ?? true;
            const yLabels: [left: number, width: number, label: string][] = [];

            const yValues: number[] = [];

            if (yLabelMin) {
                yValues.push(yMin);
            }

            if (yLabelMax) {
                yValues.push(yMax);
            }

            yValues.push(yEnd, yStart, 0);

            for (const y of yValues) {
                const label = yLabel(y);
                const labelWidth = textWidth(label);
                const intYfrac = subCharWidth * (y / ySize);
                const intY = intYfrac < 0 ? Math.floor(intYfrac) : Math.ceil(intYfrac);
                let yIndex = ((intY / 8)|0) + ((intYZero / 8)|0) + prefixWidth;

                if (yIndex + labelWidth > width) {
                    yIndex = width - labelWidth;
                }

                if (yIndex < 0) {
                    yIndex = 0;
                }

                let overlap = false;
                for (const [left, labelWidth] of yLabels) {
                    if (
                        (yIndex >= left && left + labelWidth > yIndex) ||
                        (left >= yIndex && yIndex + labelWidth > left)
                    ) {
                        overlap = true;
                        break;
                    }
                }

                if (!overlap) {
                    yLabels.push([yIndex, labelWidth, label]);
                }
            }

            yLabels.sort((lhs, rhs) => lhs[0] - rhs[0]);

            const line: string[] = [bg, textFG];
            let prevIndex = 0;
            for (const [left, labelWidth, label] of yLabels) {
                if (prevIndex < left) {
                    line.push(' '.repeat(left - prevIndex));
                }
                line.push(label);
                prevIndex = left + labelWidth;
            }

            if (prevIndex < width) {
                line.push(' '.repeat(width - prevIndex));
            }

            line.push(NORMAL);

            if (yLabelPosition === 'before') {
                lines.push(line.join(''));
            } else {
                footer.unshift(line.join(''));
            }
        }

        for (const item of datas) {
            const values = new Int32Array(xSize);

            for (let x = 0; x < xSize; ++ x) {
                const y = item.data.length > x ? item.data[x] : 0;
                const intY = subCharWidth * (y / ySize);
                values[x] = intY < 0 ? Math.floor(intY) : Math.ceil(intY);
            }

            intValues.push(values);
        }

        const emptyLine = ' '.repeat(chartWidth);
        let lineIndex = 0;
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

                const line: string[] = [];

                let yIndex = chartWidth - 1;

                if (index === 0) {
                    const endSpaceIndex = lineIndex + vSpaceWidth;
                    for (; lineIndex < endSpaceIndex; ++ lineIndex) {
                        lines.push(`${bg}${textFG}${prefix[lineIndex] ?? ''}${emptyLine}${suffix[lineIndex] ?? ''}${NORMAL}`);
                    }
                }

                if (value >= 0) {
                    if (yIndex > clampedYZeroIndex) {
                        line.push(textFG, ' '.repeat(yIndex - clampedYZeroIndex));
                        yIndex = clampedYZeroIndex;
                    }

                    if (yIndex >= yEndIndex) {
                        line.push(fg, '█'.repeat(yIndex - yEndIndex + 1));
                        yIndex = yEndIndex - 1;
                    } else {
                        line.push(fg);
                    }

                    if (yIndex >= 0) {
                        if (yIndex === yEndIndex - 1) {
                            const subSteps = value % 8;
                            if (subSteps !== 0) {
                                line.push(HCHAR_MAP[subSteps]);
                                -- yIndex;
                            }
                        }

                        line.push(textFG);

                        if (yIndex >= 0) {
                            line.push(' '.repeat(yIndex + 1));
                        }
                    } else {
                        line.push(textFG);
                    }
                } else if (value < 0) {
                    if (yIndex > yEndIndex) {
                        line.push(textFG, ' '.repeat(yIndex - yEndIndex));
                        yIndex = yEndIndex;
                    }

                    if (yIndex >= 0) {
                        if (yIndex === yEndIndex) {
                            const subSteps = value % 8;
                            if (subSteps !== 0) {
                                const fgInv = COLOR_MAP[color][1];
                                line.push(bgInv, fgInv, HCHAR_MAP[8 + subSteps], bg, fg);
                            } else {
                                line.push(' ', fg);
                            }
                            -- yIndex;
                        } else {
                            line.push(fg);
                        }

                        if (yIndex > clampedYZeroIndex) {
                            line.push('█'.repeat(yIndex - clampedYZeroIndex));
                            yIndex = clampedYZeroIndex;
                        }

                        line.push(textFG);

                        if (yIndex >= 0) {
                            line.push(' '.repeat(yIndex + 1));
                        }
                    } else {
                        line.push(textFG);
                    }
                }

                const lineStr = line.join('');
                const barEndIndex = lineIndex + barWidth;
                for (; lineIndex < barEndIndex; ++ lineIndex) {
                    lines.push(`${bg}${textFG}${prefix[lineIndex] ?? ''}${lineStr}${suffix[lineIndex] ?? ''}${NORMAL}`);
                }
            }
        }

        for (; lineIndex < chartHeight; ++ lineIndex) {
            lines.push(`${bg}${textFG}${prefix[lineIndex] ?? ''}${emptyLine}${suffix[lineIndex] ?? ''}${NORMAL}`);
        }
    }

    lines.push(...footer);

    return lines;
}

const ZERO_WIDTH_REGEX = /\x1B\[\d+(;\d+){0,4}m|[\u{E000}-\u{FFFF}\u{200B}-\u{200D}\u{2060}\u{FEFF}\p{Mn}]/gu;
// XXX: There are also half-width and full-width characters, emojis, flags etc. that all have different widths.

/** A very simple function to measure text width as displayed on the terminal.
 * 
 * **NOTE:** Slow and not very accurat. It doesn't handle things like emojis or any non-latin characters.
 * 
 * @param text The text to measure.
 * @returns The width of the text.
 */
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

/** Basic ANSI terminal colors.
 * 
 * Depending on your terminal `'gray'` might just look like `'white'` and
 * the `'bright_'` colors might just look like the normal colors.
 */
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

export default unicodeBarChart;
