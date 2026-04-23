import fs from 'node:fs/promises'
import path from 'node:path'

const projectRoot = process.cwd()
const srcDir = path.join(projectRoot, 'src')
const fileViolations = []
const functionViolations = []

const countBraces = (line) => {
    const open = (line.match(/\{/g) || []).length
    const close = (line.match(/\}/g) || []).length
    return open - close
}

const matchesFunctionStart = (line) => {
    const fnDecl = /^\s*(export\s+)?(async\s+)?function\s+[A-Za-z_$][\w$]*\s*\([^)]*\)\s*\{/
    const methodDecl = /^\s*(async\s+)?(?!if\b|for\b|while\b|switch\b|catch\b)[A-Za-z_$][\w$]*\s*\([^)]*\)\s*\{/
    const arrowDecl = /^\s*(export\s+)?const\s+[A-Za-z_$][\w$]*\s*=\s*(async\s*)?\([^)]*\)\s*=>\s*\{/
    return fnDecl.test(line) || methodDecl.test(line) || arrowDecl.test(line)
}

const walkFiles = async (dir) => {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    const files = []

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            const nestedFiles = await walkFiles(fullPath)
            files.push(...nestedFiles)
            continue
        }
        if (entry.isFile() && fullPath.endsWith('.ts')) {
            files.push(fullPath)
        }
    }

    return files
}

const checkFileSize = (filePath, lines) => {
    const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, '/')
    const maxLines = relativePath === 'src/app.ts' ? 180 : 250
    if (lines.length > maxLines) {
        fileViolations.push(`${relativePath}: ${lines.length} lines (max ${maxLines})`)
    }
}

const checkFunctionSize = (filePath, lines) => {
    const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, '/')
    const stack = []

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index]

        if (matchesFunctionStart(line)) {
            stack.push({
                startLine: index + 1,
                braceBalance: countBraces(line),
            })
            continue
        }

        if (!stack.length) continue

        stack[stack.length - 1].braceBalance += countBraces(line)
        if (stack[stack.length - 1].braceBalance > 0) continue

        const fn = stack.pop()
        const length = index + 1 - fn.startLine + 1
        if (length > 40) {
            functionViolations.push(`${relativePath}:${fn.startLine} -> ${length} lines (max 40)`)
        }
    }
}

const main = async () => {
    const files = await walkFiles(srcDir)

    for (const filePath of files) {
        const content = await fs.readFile(filePath, 'utf8')
        const lines = content.split('\n')
        checkFileSize(filePath, lines)
        checkFunctionSize(filePath, lines)
    }

    if (!fileViolations.length && !functionViolations.length) {
        console.log('Structure checks passed.')
        return
    }

    console.error('Structure checks failed.')
    if (fileViolations.length) {
        console.error('\nFile size violations:')
        fileViolations.forEach((line) => console.error(`- ${line}`))
    }
    if (functionViolations.length) {
        console.error('\nFunction size violations:')
        functionViolations.forEach((line) => console.error(`- ${line}`))
    }

    process.exit(1)
}

main().catch((error) => {
    console.error('Failed to run structure checks:', error)
    process.exit(1)
})
