import { isArray } from "@pnp/core";
import { defaultPath } from "../decorators.js";
import { _SPInstance, spInvokableFactory, _SPCollection } from "../spqueryable.js";
import { encodePath } from "../utils/encode-path-str.js";

/**
 * Describes a collection of Form objects
 *
 */
@defaultPath("_api/v2.1/termstore")
export class _TermStore extends _SPInstance<ITermStoreInfo> {

    /**
     * Gets the term groups associated with this tenant
     */
    public get groups(): ITermGroups {
        return TermGroups(this);
    }

    /**
     * Gets the term sets associated with this tenant
     */
    public get sets(): ITermSets {
        return TermSets(this);
    }

    /**
     * Allows you to locate terms within the termStore
     *
     * @param params Search parameters used to locate the terms, label is required
     * @returns Array of terms including set information for each term
     */
    public async searchTerm(params: ISearchTermParams): Promise<Required<Pick<ITermInfo, SearchTermPickedProps>>[]> {

        const query = Reflect.ownKeys(params).reduce((c, prop: string) => {
            c.push(`${prop}='${encodePath(params[prop])}'`);
            return c;
        }, []).join(",");

        return TermStore(this, `searchTerm(${query})`).expand("set")();
    }
}
export interface ITermStore extends _TermStore { }
export const TermStore = spInvokableFactory<ITermStore>(_TermStore);

@defaultPath("groups")
export class _TermGroups extends _SPCollection<ITermGroupInfo[]> {

    /**
     * Gets a term group by id
     *
     * @param id Id of the term group to access
     */
    public getById(id: string): ITermGroup {
        return TermGroup(this, id);
    }
}
export interface ITermGroups extends _TermGroups { }
export const TermGroups = spInvokableFactory<ITermGroups>(_TermGroups);

export class _TermGroup extends _SPInstance<ITermGroupInfo> {

    /**
     * Gets the term sets associated with this tenant
     */
    public get sets(): ITermSets {
        return TermSets(this, "sets");
    }
}
export interface ITermGroup extends _TermGroup { }
export const TermGroup = spInvokableFactory<ITermGroup>(_TermGroup);


@defaultPath("sets")
export class _TermSets extends _SPCollection<ITermSetInfo[]> {

    /**
     * Gets a term group by id
     *
     * @param id Id of the term group to access
     */
    public getById(id: string): ITermSet {
        return TermSet(this, id);
    }
}
export interface ITermSets extends _TermSets { }
export const TermSets = spInvokableFactory<ITermSets>(_TermSets);

export class _TermSet extends _SPInstance<ITermSetInfo> {

    /**
     * Gets all the terms in this set
     */
    public get terms(): ITerms {
        return Terms(this);
    }

    public get parentGroup(): ITermGroup {
        return TermGroup(this, "parentGroup");
    }

    public get children(): IChildren {
        return Children(this);
    }

    public get relations(): IRelations {
        return Relations(this);
    }

    public getTermById(id: string): ITerm {
        return Term(this, `terms/${id}`);
    }

    /**
     * Gets all the terms in this termset in an ordered tree using the appropriate sort ordering
     * ** This is an expensive operation and you should strongly consider caching the results **
     *
     * @param props Optional set of properties controlling how the tree is retrieved.
     */
    public async getAllChildrenAsOrderedTree(props: Partial<IGetOrderedTreeProps> = {}): Promise<IOrderedTermInfo[]> {

        const selects = ["*", "customSortOrder"];
        if (props.retrieveProperties) {
            selects.push("properties", "localProperties");
        }

        const setInfo = await this.select(...selects)();
        const tree: IOrderedTermInfo[] = [];

        const ensureOrder = (terms: IOrderedTermInfo[], sorts: ITermSortOrderInfo[], setSorts?: string[]): IOrderedTermInfo[] => {

            // handle no custom sort information present
            if (!isArray(sorts) && !isArray(setSorts)) {
                return terms;
            }

            let ordering: string[] = null;
            if (sorts === null && setSorts.length > 0) {
                ordering = [...setSorts];
            } else {
                const index = sorts.findIndex(v => v.setId === setInfo.id);
                if (index >= 0) {
                    ordering = [...sorts[index].order];
                }
            }

            if (ordering !== null) {
                const orderedChildren = [];
                ordering.forEach(o => {
                    const found = terms.find(ch => o === ch.id);
                    if (found) {
                        orderedChildren.push(found);
                    }
                });
                // we have a case where if a set is ordered and a term is added to that set
                // AND the ordering information hasn't been updated in the UI the new term will not have
                // any associated ordering information. See #1547 which reported this. So here we
                // append any terms remaining in "terms" not in "orderedChildren" to the end of "orderedChildren"
                orderedChildren.push(...terms.filter(info => ordering.indexOf(info.id) < 0));

                return orderedChildren;
            }
            return terms;
        };

        const visitor = async (source: any, parent: IOrderedTermInfo[]) => {

            const children = await source.children.select(...selects)();

            for (let i = 0; i < children.length; i++) {

                const child = children[i];

                const orderedTerm: Partial<IOrderedTermInfo> = {
                    children: <IOrderedTermInfo[]>[],
                    defaultLabel: child.labels.find(l => l.isDefault).name,
                    ...child,
                };

                if (child.childrenCount > 0) {
                    await visitor(this.getTermById(children[i].id), <any>orderedTerm.children);
                    orderedTerm.children = ensureOrder(<any>orderedTerm.children, child.customSortOrder);
                }

                parent.push(<Required<IOrderedTermInfo>>orderedTerm);
            }
        };

        await visitor(this, tree);

        return ensureOrder(tree, null, setInfo.customSortOrder);
    }
}
export interface ITermSet extends _TermSet { }
export const TermSet = spInvokableFactory<ITermSet>(_TermSet);

@defaultPath("children")
export class _Children extends _SPCollection<ITermInfo[]> { }
export interface IChildren extends _Children { }
export const Children = spInvokableFactory<IChildren>(_Children);

@defaultPath("terms")
export class _Terms extends _SPCollection<ITermInfo[]> {
    /**
     * Gets a term group by id
     *
     * @param id Id of the term group to access
     */
    public getById(id: string): ITerm {
        return Term(this, id);
    }
}
export interface ITerms extends _Terms { }
export const Terms = spInvokableFactory<ITerms>(_Terms);

export class _Term extends _SPInstance<ITermInfo> {

    public get terms(): IChildren {
        return Terms(this);
    }

    public get children(): IChildren {
        return Children(this);
    }

    public get relations(): IRelations {
        return Relations(this);
    }

    public get set(): ITermSet {
        return TermSet(this, "set");
    }
}
export interface ITerm extends _Term { }
export const Term = spInvokableFactory<ITerm>(_Term);


@defaultPath("relations")
export class _Relations extends _SPCollection<IRelationInfo[]> {
    /**
     * Gets a term group by id
     *
     * @param id Id of the term group to access
     */
    public getById(id: string): IRelation {
        return Relation(this, id);
    }
}
export interface IRelations extends _Relations { }
export const Relations = spInvokableFactory<IRelations>(_Relations);

export class _Relation extends _SPInstance<IRelationInfo> {

    public get fromTerm(): ITerm {
        return Term(this, "fromTerm");
    }

    public get toTerm(): ITerm {
        return Term(this, "toTerm");
    }

    public get set(): ITermSet {
        return TermSet(this, "set");
    }
}
export interface IRelation extends _Relation { }
export const Relation = spInvokableFactory<IRelation>(_Relation);

export interface ITermStoreInfo {
    id: string;
    name: string;
    defaultLanguageTag: string;
    languageTags: string[];
    administrators?: ITaxonomyUserInfo;
}

export interface ITermGroupInfo {
    id: string;
    description: string;
    name: string;
    displayName: string;
    createdDateTime: string;
    lastModifiedDateTime: string;
    type: string;
    scope: "global" | "system" | "siteCollection";
}

export interface ITermSetInfo {
    id: string;
    localizedNames: { name: string; languageTag: string }[];
    description: string;
    createdDateTime: string;
    customSortOrder: string[];
    properties?: ITaxonomyProperty[];
    childrenCount: number;
    groupId: string;
    isOpen: boolean;
    isAvailableForTagging: boolean;
    contact: string;
}

export interface ITermInfo {
    childrenCount: number;
    id: string;
    labels: { name: string; isDefault: boolean; languageTag: string }[];
    createdDateTime: string;
    customSortOrder?: ITermSortOrderInfo[];
    lastModifiedDateTime: string;
    descriptions: { description: string; languageTag: string }[];
    properties?: ITaxonomyProperty[];
    localProperties?: ITaxonomyLocalProperty[];
    isDeprecated: boolean;
    isAvailableForTagging: { setId: string; isAvailable: boolean }[];
    topicRequested?: boolean;
    parent?: ITermInfo;
    set?: ITermSetInfo;
    relations?: IRelationInfo[];
    children?: ITermInfo[];
}

export interface ISearchTermParams {
    /**
     * The term label to search for.
     */
    label: string;
    /**
     * The setId to scope down the search under a termSet.
     */
    setId?: string;
    /**
     * The parentTermId to scope down the search under a termSet, under a parent term.
     */
    parentTermId?: string;
    /**
     * The languageTag to scope down the search to a specific language.
     */
    languageTag?: string;
    /**
     * Indicates what type of string matching should be performed when searching.
     */
    stringMatchOption?: "ExactMatch" | "StartsWith";
}

type SearchTermPickedProps = "childrenCount" | "createdDateTime" | "descriptions" | "id" | "isAvailableForTagging" | "isDeprecated" | "labels" | "lastModifiedDateTime" | "set";

export interface ITermSortOrderInfo {
    setId: string;
    order: string[];
}

export interface IOrderedTermInfo extends ITermInfo {
    children: ITermInfo[];
    defaultLabel: string;
}

export interface IRelationInfo {
    id: string;
    relationType: string;
}

export interface ITaxonomyUserInfo {
    user: {
        displayName: string;
        email: string;
        id: string;
    };
}

export interface ITaxonomyProperty {
    key: string;
    value: string;
}

export interface ITaxonomyLocalProperty {
    setId: string;
    properties: ITaxonomyProperty[];
}

export interface IGetOrderedTreeProps {
    retrieveProperties: boolean;
}
