
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SSHHandler } from '../ssh'


// Define mocks
vi.hoisted(() => {
    // We need to use require here because imports are hoisted above this block but we need
    // to ensure EventEmitter is available. Actually, vi.hoisted runs before imports.
    // So we can't use 'events' import easily if we want to extend it inside hoisted block.
    // Simpler: use the mock factory pattern where we construct the class inside.
    //
    // However, to share the class definition with the test (to assertions), we need it accessible.
    // A trick: Define a simple mock and rely on checks against the instances.
    //
    // Instead of complex hoisting, let's just define the shape in the mock factory
    // and spy on prototypes in tests.
    return { MockClient: vi.fn(), MockSFTPWrapper: vi.fn() }
})

vi.mock('ssh2', async () => {
    const EventEmitter = (await import('events')).EventEmitter

    class MockClient extends EventEmitter { }
    // @ts-expect-error Mocking connect
    MockClient.prototype.connect = vi.fn().mockReturnThis()
    // @ts-expect-error Mocking sftp
    MockClient.prototype.sftp = vi.fn()
    // @ts-expect-error Mocking shell
    MockClient.prototype.shell = vi.fn()
    // @ts-expect-error Mocking end
    MockClient.prototype.end = vi.fn()

    class MockSFTPWrapper extends EventEmitter { }
    // @ts-expect-error Mocking readdir
    MockSFTPWrapper.prototype.readdir = vi.fn()
    // @ts-expect-error Mocking mkdir
    MockSFTPWrapper.prototype.mkdir = vi.fn()
    // @ts-expect-error Mocking fastGet
    MockSFTPWrapper.prototype.fastGet = vi.fn()
    // @ts-expect-error Mocking fastPut
    MockSFTPWrapper.prototype.fastPut = vi.fn()
    // @ts-expect-error Mocking stat
    MockSFTPWrapper.prototype.stat = vi.fn()
    // @ts-expect-error Mocking createReadStream
    MockSFTPWrapper.prototype.createReadStream = vi.fn()
    // @ts-expect-error Mocking writeFile
    MockSFTPWrapper.prototype.writeFile = vi.fn()
    // @ts-expect-error Mocking end
    MockSFTPWrapper.prototype.end = vi.fn()

    return {
        Client: MockClient,
        SFTPWrapper: MockSFTPWrapper,
        ConnectConfig: {},
        ClientChannel: {},
    }
})

// Mock fs
vi.mock('node:fs/promises', () => ({
    default: {
        readFile: vi.fn(),
        mkdir: vi.fn(),
        stat: vi.fn(),
        readdir: vi.fn(),
    }
}))

describe('SSHHandler', () => {
    let handler: SSHHandler
    let mockClientPrototype: { connect: import('vitest').Mock, sftp: import('vitest').Mock }
    let mockSftpInstance: { readdir: import('vitest').Mock }

    beforeEach(async () => {
        vi.clearAllMocks()

        // Retrieve the mocked classes to spy on them
        const ssh2 = await import('ssh2')
        // @ts-expect-error Using mock prototype
        mockClientPrototype = ssh2.Client.prototype

        // Setup default behaviors
        mockClientPrototype.connect.mockImplementation(function (this: import('events').EventEmitter) {
            setTimeout(() => {
                this.emit('ready')
            }, 0)
            return this
        })

        // We need an instance of SFTPWrapper to be passed to the callback
        // @ts-expect-error Instantiating mock
        mockSftpInstance = new ssh2.SFTPWrapper()

        mockClientPrototype.sftp.mockImplementation((cb: (err: null, inst: unknown) => void) => {
            cb(null, mockSftpInstance)
            return true
        })

        handler = new SSHHandler()
    })

    it('should connect successfully with password', async () => {
        const config = {
            host: 'localhost',
            port: 22,
            username: 'user',
            password: 'password'
        }

        const result = await handler.connect(config)
        expect(result).toEqual({ status: 'connected' })

        expect(mockClientPrototype.connect).toHaveBeenCalledWith(expect.objectContaining({
            host: 'localhost',
            username: 'user',
            password: 'password'
        }))
    })

    it('should fail connection on error', async () => {
        const config = {
            host: 'localhost',
            port: 22,
            username: 'user',
            password: 'password'
        }

        mockClientPrototype.connect.mockImplementation(function (this: import('events').EventEmitter) {
            setTimeout(() => {
                this.emit('error', new Error('Connection failed'))
            }, 0)
            return this
        })

        await expect(handler.connect(config)).rejects.toThrow('Connection failed')
    })

    it('should list files', async () => {
        const config = {
            host: 'localhost',
            port: 22,
            username: 'user',
            password: 'password'
        }
        await handler.connect(config)

        const mockEntries = [
            {
                filename: 'file1.txt',
                attrs: {
                    isDirectory: () => false,
                    size: 1024,
                    mtime: 1600000000
                }
            },
            {
                filename: 'folder1',
                attrs: {
                    isDirectory: () => true,
                    size: 4096,
                    mtime: 1600000000
                }
            }
        ]

        // This needs to be set on the instance that was returned
        mockSftpInstance.readdir.mockImplementation((_path: string, cb: (err: null, data: unknown) => void) => {
            cb(null, mockEntries)
        })

        const files = await handler.list('/some/path')
        expect(files).toHaveLength(2)
        expect(files[0].name).toBe('file1.txt')
        expect(files[1].isDirectory).toBe(true)
    })
})
