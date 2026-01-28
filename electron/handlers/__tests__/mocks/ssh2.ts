
import { vi } from 'vitest'
import EventEmitter from 'events'

export class MockClient extends EventEmitter {
    connect = vi.fn().mockReturnThis()
    sftp = vi.fn()
    shell = vi.fn()
    end = vi.fn()
}

export class MockSFTPWrapper extends EventEmitter {
    readdir = vi.fn()
    mkdir = vi.fn()
    fastGet = vi.fn()
    fastPut = vi.fn()
    stat = vi.fn()
    createReadStream = vi.fn()
    writeFile = vi.fn()
    end = vi.fn()
}

export class MockClientChannel extends EventEmitter {
    write = vi.fn()
    setWindow = vi.fn()
    end = vi.fn()
}
