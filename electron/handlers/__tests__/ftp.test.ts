
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FTPHandler } from '../ftp'
import * as ftp from 'basic-ftp'

// Mock basic-ftp
vi.mock('basic-ftp', () => {
    const MockClient = vi.fn(() => ({
        access: vi.fn(),
        list: vi.fn(),
        close: vi.fn(),
        downloadTo: vi.fn(),
        uploadFrom: vi.fn(),
        trackProgress: vi.fn()
    }))
    return {
        Client: MockClient
    }
})

describe('FTPHandler', () => {
    let handler: FTPHandler
    let mockClientInstance: any

    beforeEach(() => {
        vi.clearAllMocks()
        handler = new FTPHandler()
        // Access the mock instance that will be created
        // Since we can't easily access the internal instance before it's created,
        // we'll spy on the constructor or just assume the mock implementation works.
    })

    it('should connect successfully', async () => {
        const config = {
            host: 'localhost',
            port: 21,
            username: 'user',
            password: 'password',
            protocol: 'ftp'
        }

        const result = await handler.connect(config)
        expect(result).toEqual({ status: 'connected' })
    })

    it('should list files', async () => {
        const config = {
            host: 'localhost',
            username: 'user',
            password: 'password'
        }
        await handler.connect(config)

        // We need to find the client instance created inside `handler.connect`
        // Since we mocked `basic-ftp`, `new ftp.Client()` return our mock object.
        // But we need to define the return value of `list` on THAT object.

        // Let's rely on `vi.mocked` or similar to get the class mock
        const MockClient = vi.mocked(ftp.Client)
        // The instance is the result of the constructor call
        const mockInstance = MockClient.mock.results[0].value

        const mockList = [
            { name: 'file1.txt', isDirectory: false, size: 100, modifiedAt: new Date() },
            { name: 'dir1', isDirectory: true, size: 0, modifiedAt: new Date() }
        ]

        mockInstance.list.mockResolvedValue(mockList)

        const files = await handler.list('/')
        expect(files).toHaveLength(2)
        expect(files[0].name).toBe('file1.txt')
        expect(files[1].isDirectory).toBe(true)
    })
})
