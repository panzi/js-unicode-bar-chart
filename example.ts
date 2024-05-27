import { DataSeries, unicodeBarChart, getTextWidth, Color, LabelPosition, Orientation } from "./index.js";

const CLEAR = '\x1B[1;1H\x1B[2J';

function centerLine(line: string, width: number): string {
    const lineWidth = getTextWidth(line);
    if (lineWidth >= width) {
        return line;
    }
    const space = width - lineWidth;
    const lpad = space >> 1;
    const rpad = space - lpad;
    return `${' '.repeat(lpad)}${line}${' '.repeat(rpad)}`;
}

function makeSeries(xSize: number, f: (x: number) => number): Float64Array {
    const data = new Float64Array(xSize);
    for (let x = 0; x < xSize; ++ x) {
        data[x] = f(x);
    }
    return data;
}

function main() {
    const message = 'Press Escape to exit.';

    process.stdout.write('\x1B[?25l\x1B[?7h');

    let interval: NodeJS.Timeout|null = null;

    const TAU = 2 * Math.PI;
    const redrawSleep = 1000/60;
    const xSize = 4;
    const redraw = () => {
        const now = Date.now() * 0.1;
        const orientation: Orientation = (now + 1_500) % 5_000 > 2_500 ? 'horizontal' : 'vertical';
        //const orientation: Orientation = 'horizontal';
        const backgroundColor: Color = now % 2_500 > 1_250 ? 'black' : 'white';
        const yLabelPosition: LabelPosition = (now +   500) % 2_500 > 1_250 ? 'before' : 'after';
        //const yLabelPosition: LabelPosition = 'before';
        const xLabelPosition: LabelPosition = (now + 1_000) % 2_500 > 1_250 ? 'before' : 'after';

        const availWidth  = process.stdout.columns ?? 80;
        const availHeight = process.stdout.rows ?? 40;
        const data: DataSeries[] = [
            {
                label: 'Data Series #1',
                data: makeSeries(xSize, x => Math.sin((TAU * ((now / 10_000) + (x / xSize))) % TAU) + 0.5),
                //data: makeSeries(xSize, x => (-x / 8) - (now-start)/5000 + 1),
            },
            {
                label: 'Data Series #2',
                data: makeSeries(xSize, x => Math.max(Math.sin((TAU * ((now / 5_000) + (x / xSize))) % TAU) * 1.1, 0)),
                //data: makeSeries(xSize, x => (-x / 8) - 2/8),
            },
            {
                label: 'Data Series #3',
                data: makeSeries(xSize, x => Math.cos((TAU * ((now / 2_000) + (x / xSize))) % TAU) * 0.75 + 1),
                //data: makeSeries(xSize, x => (-x / 8) - 3/8),
            },
            {
                label: 'Data Series #4',
                data: makeSeries(xSize, x => Math.sin((TAU * ((now / 3_000) + (x / xSize))) % TAU) * 0.5 + 0.4),
                //data: makeSeries(xSize, x => (-x / 8) - 4/8),
            },
            {
                label: 'Data Series #5',
                data: makeSeries(xSize, x => Math.sin((TAU * ((now / 2_500) + (x / xSize))) % TAU)),
            },
            {
                label: 'Data Series #6',
                data: makeSeries(xSize, x => ((now / 3_500) + x) % 2 - 1),
            },
            {
                label: 'Data Series #7',
                data: makeSeries(xSize, x => x / 2 - 1 / 4),
            },
        ];

        const lines = unicodeBarChart(data, {
            yRange: [-1, 2],
            //xLabel: x => `Year ${2001 + x + x * x} This is a long label to demonstrate how it gets wrapped. AVeryLongWordBlablaBlaBla`,
            xLabel: x => `Year ${2001 + x + x * x}`,
            yLabel: y => y.toFixed(3),
            yLabelPosition,
            xLabelPosition,
            width:  availWidth,
            height: availHeight - 2,
            orientation,
            backgroundColor,
            //textColor: 'black',
        });
        lines.push('');
        lines.push(centerLine(message, availWidth));

        process.stdout.write(CLEAR + lines.join('\n'));
    };

    interval = setInterval(redraw, redrawSleep);

    const shutdown = () => {
        if (interval !== null) {
            clearInterval(interval);
            interval = null;
        }
        process.stdin.off('data', onInput);
        process.stdin.destroy();
    };

    const onInput = (data: Buffer) => {
        if (data.includes(0x1B) || data.includes(0x71) || data.includes(0x03)) {
            shutdown();
        }
    };

    process.stdin.setRawMode(true);
    process.stdin.setNoDelay(true);
    process.stdin.on('data', onInput);

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('exit', () => {
        process.stdout.write('\x1B[?25h\x1B[=7h\n');
    });
}

main();
