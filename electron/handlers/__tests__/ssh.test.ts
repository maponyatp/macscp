
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SSHHandler } from '../ssh'
import { MockClient, MockSFTPWrapper } from './mocks/ssh2'
import * as ssh2 from 'ssh2'
import fs from 'node:fs/promises'

// Mock ssh2
vi.mock('ssh2', () => {
    return {
        Client: MockClient,
        ConnectConfig: {},
        SFTPWrapper: MockSFTPWrapper,
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
    let mockClient: MockClient
    let mockSftp: MockSFTPWrapper

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks()

        // Setup mock implementations
        mockSftp = new MockSFTPWrapper()
        mockClient = new MockClient()

        // We need to hijack the Client constructor to return our mock instance
        // But since we mocked the module, the class imported in ssh.ts is already our mock.
        // However, we need access to the specific instance created inside SSHHandler.
        // A better approach is to mock the module such that `new Client()` returns our `mockClient`

        // Refine mock:
        // When `new Client()` is called, return `mockClient`
        // We'll trust the module mock above does mostly the right thing, 
        // but we need to ensure the `connect` method works as expected.

        handler = new SSHHandler()
    })

    it('should connect successfully with password', async () => {
        const config = {
            host: 'localhost',
            port: 22,
            username: 'user',
            password: 'password'
        }

        // Setup the ready flow
        mockClient.connect.mockImplementation(function (this: MockClient) {
            setTimeout(() => {
                this.emit('ready')
            }, 10)
            return this
        })

        mockClient.sftp.mockImplementation((cb) => {
            cb(null, mockSftp)
            return true
        })

        // We need to make sure SSHHandler uses the mock we control.
        // Since we mocked `ssh2` module, `new Client()` inside SSHHandler will instantiate our MockClient.
        // To control *that* instance, we can spy on the constructor or prototype? 
        // Actually, since `vi.mock` hoists, the `Client` imported in `ssh.ts` is `MockClient`.
        // So `new Client()` creates a `MockClient`. We just need to make sure we can control *all* instances 
        // or hook into it.

        // Let's rely on the fact that we can mock the prototype methods if needed, 
        // OR better: create a way to access the instance.
        // For simplicity, let's assume valid flow:

        // Override the inner implementation of Client to return our prepared mock instance if needed,
        // or just rely on standard mocking behavior where we configure the prototype or subsequent calls.
        // Since `MockClient` is a class, `new Client()` creates a NEW instance of `MockClient`. 
        // We need to configure the methods on `MockClient.prototype` to affect all instances.

        MockClient.prototype.connect.mockImplementation(function (this: MockClient) {
            setTimeout(() => {
                this.emit('ready')
            }, 0)
            return this
        })

        MockClient.prototype.sftp.mockImplementation((cb: any) => {
            cb(null, mockSftp)
            return true
        })

        const result = await handler.connect(config)
        expect(result).toEqual({ status: 'connected' })
        expect(MockClient.prototype.connect).toHaveBeenCalledWith(expect.objectContaining({
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

        MockClient.prototype.connect.mockImplementation(function (this: MockClient) {
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

        // Connect first
        MockClient.prototype.connect.mockImplementation(function (this: MockClient) {
            setTimeout(() => {
                this.emit('ready')
            }, 0)
            return this
        })
        MockClient.prototype.sftp.mockImplementation((cb: any) => {
            cb(null, mockSftp)
            return true
        })
        await handler.connect(config)

        // Mock readdir
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

        mockSftp.readdir.mockImplementation((path: string, cb: any) => {
            cb(null, mockEntries)
        })

        const files = await handler.list('/some/path')
        expect(files).toHaveLength(2)
        expect(files[0].name).toBe('file1.txt')
        expect(files[0].isDirectory).toBe(false)
        expect(files[1].name).toBe('folder1')
        expect(files[1].isDirectory).toBe(true)
    })
})
