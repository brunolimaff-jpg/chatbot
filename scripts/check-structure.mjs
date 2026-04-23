import fs from 'node:fs/promises'
import path from 'node:path'
import ts from 'typescript'

const projectRoot = process.cwd()
const srcDir = path.join(projectRoot, 'src')
const fileViolations = []
const functionViolations = []

const splitLines = (text) => text.split(/\r?\n/)

const walkFiles = async (dir) => {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    const files = []

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            files.push(...(await walkFiles(fullPath)))
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

const toLine = (sourceFile, position) => sourceFile.getLineAndCharacterOfPosition(position).line + 1

const shouldTrackFunctionLike = (node) => {
    if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) return true
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
        return ts.isVariableDeclaration(node.parent)
    }
    return false
}

const functionDisplayName = (node) => {
    if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
        return node.name?.getText() ?? '<anonymous>'
    }

    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
        if (ts.isVariableDeclaration(node.parent)) {
            return node.parent.name.getText()
        }
    }

    return '<anonymous>'
}

const checkFunctionSize = (filePath, content) => {
    const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, '/')
    const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

    const visit = (node) => {
        if (shouldTrackFunctionLike(node)) {
            const startLine = toLine(sourceFile, node.getStart(sourceFile))
            const endLine = toLine(sourceFile, node.end)
            const length = endLine - startLine + 1

            if (length > 40) {
                functionViolations.push(
                    `${relativePath}:${startLine} -> ${length} lines (max 40) [${functionDisplayName(node)}]`
                )
            }
        }

        ts.forEachChild(node, visit)
    }

    visit(sourceFile)
}

const printAndExit = () => {
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

const main = async () => {
    const files = await walkFiles(srcDir)

    for (const filePath of files) {
        const content = await fs.readFile(filePath, 'utf8')
        checkFileSize(filePath, splitLines(content))
        checkFunctionSize(filePath, content)
    }

    if (!fileViolations.length && !functionViolations.length) {
        console.log('Structure checks passed.')
        return
    }

    printAndExit()
}

main().catch((error) => {
    console.error('Failed to run structure checks:', error)
    process.exit(1)
})
