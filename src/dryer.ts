import mongoose from 'mongoose';
import { MongooseSchemaBuilder } from './mongoose-schema-builder';
import { GraphqlTypeBuilder } from './graphql-schema-builder';
import { CreateApi, DeleteApi, GetApi, ListApi, UpdateApi } from './apis';
import { Apollo } from './apollo';

interface DryerConfig {
    modelDefinitions: { [key: string]: any };
    beforeApplicationInit?: Function;
    afterApplicationInit?: Function;
    mongoUri: string;
    port: number;
}

export class Dryer {
    private constructor(private config: DryerConfig) {}

    public static init(config: DryerConfig) {
        return new Dryer(config);
    }

    public async start() {
        await this.config?.beforeApplicationInit?.();
        let mutationFields = {};
        let queryFields = {};

        for (const name in this.config.modelDefinitions) {
            const modelDefinition = this.config.modelDefinitions[name];
            const mongooseSchema = MongooseSchemaBuilder.build(modelDefinition);
            const dbModel = mongoose.model(modelDefinition.name, mongooseSchema as any);
            const prebuiltGraphqlSchemaTypes = GraphqlTypeBuilder.build(modelDefinition);
            const model = {
                name: modelDefinition.name,
                db: dbModel,
                graphql: prebuiltGraphqlSchemaTypes,
                definition: modelDefinition,
            };

            mutationFields = {
                ...mutationFields,
                ...new CreateApi(model, {}).endpoint,
                ...new UpdateApi(model, {}).endpoint,
                ...new DeleteApi(model, {}).endpoint,
            };
            queryFields = {
                ...queryFields,
                ...new GetApi(model, {}).endpoint,
                ...new ListApi(model, {}).endpoint,
            };
        }
        await mongoose.connect(this.config.mongoUri);
        await Apollo.start({
            mutationFields,
            queryFields,
            port: this.config.port,
        });
        await this.config?.afterApplicationInit?.();
    }
}
