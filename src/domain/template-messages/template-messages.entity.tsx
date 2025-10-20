import { mockDatabase } from "../../db/mock.db"
import { TemplateGroup } from "./template-messages.types"



class TemplateMessages {


    async getMessages(): Promise<TemplateGroup[]> {
        const env = process.env.NODE_ENV

        if (env === "development") {
            return await this.getMockedMessages()
        }

        return await this.getMockedMessages()

    }


    async getMockedMessages(): Promise<TemplateGroup[]> {

        return new Promise(resolve => setTimeout(() => resolve(mockDatabase), 200))
    }
}

const templateMessagesEntity = new TemplateMessages()
export default templateMessagesEntity