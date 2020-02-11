import { sequelize } from '../connect';
import { CODES, DEFAULT_SUCCESS_RESULT } from '../constants';

export class GroupsService {
  constructor(groupsModel, usersModel, userGroupModel) {
    this.users = usersModel;
    this.groups = groupsModel;
    this.userGroup = userGroupModel;

    this.groups.belongsToMany(this.users, {
      through: 'userGroupRelations',
      foreignKey: 'groupId',
      otherKey: 'userId',
      as: 'users',
    });

    this.users.belongsToMany(this.groups, {
      through: 'userGroupRelations',
      foreignKey: 'userId',
      otherKey: 'groupId',
      as: 'groups',
    });

    this.users.sync();
    this.userGroup.sync();
    this.groups.sync();
  }

  async existsByParams({ params, model = this.groups }) {
    return model.findOne({ where: params });
  }

  async existsById({ id, params, model = this.groups }) {
    return model.findByPk(id, params);
  }

  async add({ name, permissions }) {
    try {
      if (await this.existsByParams({ params: { name } })) {
        return { success: false, code: CODES.BAD_DATA, message: 'Name exists' };
      }
      const createdGroup = await this.groups.create({ name, permissions });
      return { DEFAULT_SUCCESS_RESULT, data: createdGroup };
    } catch (e) {
      return { success: false, code: CODES.SOMETHING_WENT_WRONG, message: 'Something went wrong' };
    }
  }

  async update(id, { name, permissions }) {
    try {
      if (await this.existsById({ id, model: this.groups })) {
        await this.groups.update({ name, permissions }, { where: { id } });
        return DEFAULT_SUCCESS_RESULT;
      }
      return { success: false, code: CODES.NOT_FOUND, message: 'Group not found' };
    } catch {
      return { success: false, code: CODES.SOMETHING_WENT_WRONG, message: 'Something went wrong' };
    }
  }

  async delete(id) {
    let transaction;
    try {
      if (await this.existsById({ id })) {
        transaction = await sequelize.transaction();
        try {
          await this.groups.destroy({ where: { id }, transaction });
          await this.userGroup.destroy({ where: { groupId: id }, transaction });
          await transaction.commit();
          return DEFAULT_SUCCESS_RESULT;
        } catch {
          await transaction.rollback();
          return { success: false, code: CODES.SOMETHING_WENT_WRONG, message: 'Something went wrong' };
        }
      }
      return { success: false, code: CODES.NOT_FOUND, message: 'Groups not found' };
    } catch {
      return { success: false, code: CODES.SOMETHING_WENT_WRONG, message: 'Something went wrong' };
    }
  }

  async addUserToGroup({ userId, groupId }) {
    try {
      const user = await this.existsById({ id: userId, model: this.users });
      const group = await this.existsById({ id: groupId, model: this.groups });
      switch (true) {
        case (!!user && !!group): {
          if (await this.existsByParams({ params: { userId, groupId }, model: this.userGroup })) {
            return { success: false, code: CODES.BAD_DATA, message: 'User is in group already' };
          }
          await this.userGroup.create({ userId, groupId });
          return DEFAULT_SUCCESS_RESULT;
        }
        case (!!user && !group):
          return { success: false, code: CODES.NOT_FOUND, message: 'Group not found' };
        case (!!group && !user):
          return { success: false, code: CODES.NOT_FOUND, message: 'User not found' };
        default:
          return { success: false, code: CODES.NOT_FOUND, message: 'User and Group not found' };
      }
    } catch {
      return { success: false, code: CODES.SOMETHING_WENT_WRONG, message: 'Something went wrong' };
    }
  }

  async getById(id) {
    try {
      const group = await this.existsById({
        id,
        params: {
          include: [{
            model: this.users,
            as: 'users',
            required: false,
            attributes: ['login', 'age', 'id'],
          }],
        }
      });
      if (group) {
        return { ...DEFAULT_SUCCESS_RESULT, data: group };
      }
      return { success: false, code: CODES.NOT_FOUND, message: 'Group not found' };
    } catch {
      return { success: false, code: CODES.SOMETHING_WENT_WRONG, message: 'Something went wrong' };
    }
  }

  async get() {
    try {
      const groups = await this.groups.findAll({
        include: [{
          model: this.users,
          as: 'users',
          required: false,
          attributes: ['login', 'age', 'id'],
          through: { attributes: [] }
        }],
      });
      return { ...DEFAULT_SUCCESS_RESULT, data: groups };
    } catch (e) {
      return { success: false, code: CODES.SOMETHING_WENT_WRONG, message: 'Something went wrong' };
    }
  }
}
