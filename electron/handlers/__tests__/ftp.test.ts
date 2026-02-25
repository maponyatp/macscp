
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FTPHandler } from '../ftp'
import * as ftp from 'basic-ftp'

// Mock basic-ftp
vi.mock('basic-ftp', () => {
    // We create a mock class structure
    const MockClient = vi.fn()
    MockClient.prototype.access = vi.fn()
    MockClient.prototype.list = vi.fn()
    MockClient.prototype.close = vi.fn()
    MockClient.prototype.downloadTo = vi.fn()
    MockClient.prototype.uploadFrom = vi.fn()
    MockClient.prototype.trackProgress = vi.fn()

    return {
        Client: MockClient
    }
})

describe('FTPHandler', () => {
    let handler: FTPHandler
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockClientPrototype: any

    beforeEach(() => {
        vi.clearAllMocks()
        handler = new FTPHandler()
        mockClientPrototype = ftp.Client.prototype
    })

    it('should connect successfully', async () => {
        const config = {
            host: 'localhost',
            port: 21,
            username: 'user',
            password: 'password',
            protocol: 'ftp' // matches the types
        }

        mockClientPrototype.access.mockResolvedValue(undefined)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await handler.connect(config as any)
        expect(result).toEqual({ status: 'connected' })
        expect(mockClientPrototype.access).toHaveBeenCalled()
    })

    it('should list files', async () => {
        const config = {
            host: 'localhost',
            username: 'user',
            password: 'password'
        }
        mockClientPrototype.access.mockResolvedValue(undefined)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await handler.connect(config as any)

        const mockList = [
            { name: 'file1.txt', isDirectory: false, size: 100, modifiedAt: new Date() },
            { name: 'dir1', isDirectory: true, size: 0, modifiedAt: new Date() }
        ]

        mockClientPrototype.list.mockResolvedValue(mockList)

        const files = await handler.list('/')
        expect(files).toHaveLength(2)
        expect(files[0].name).toBe('file1.txt')
        expect(files[1].isDirectory).toBe(true)
    })
})
